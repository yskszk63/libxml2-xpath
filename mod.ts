if (Deno.build.arch !== "x86_64" || Deno.build.os !== "linux") {
  throw new Error("Unsupporeted platform.");
}

const lib = Deno.dlopen("libxml2.so", {
  "xmlFree": {
    parameters: ["pointer"],
    result: "void",
    nonblocking: false,
  },
  "xmlCreatePushParserCtxt": {
    parameters: ["pointer", "pointer", "pointer", "usize", "pointer"],
    result: "pointer",
    nonblocking: false,
  },
  "xmlFreeParserCtxt": {
    parameters: ["pointer"],
    result: "void",
    nonblocking: false,
  },
  "xmlParseChunk": {
    parameters: ["pointer", "pointer", "usize", "u32"],
    result: "u32",
    nonblocking: false,
  },
  "xmlFreeDoc": {
    parameters: ["pointer"],
    result: "void",
    nonblocking: false,
  },
  "xmlXPathNewContext": {
    parameters: ["pointer"],
    result: "pointer",
    nonblocking: false,
  },
  "xmlXPathFreeContext": {
    parameters: ["pointer"],
    result: "void",
    nonblocking: false,
  },
  "xmlXPathEval": {
    parameters: ["pointer", "pointer"],
    result: "pointer",
    nonblocking: false,
  },
  "xmlXPathNodeEval": {
    parameters: ["pointer", "pointer", "pointer"],
    result: "pointer",
    nonblocking: false,
  },
  "xmlXPathFreeObject": {
    parameters: ["pointer"],
    result: "void",
    nonblocking: false,
  },
  "xmlNodeGetContent": {
    parameters: ["pointer"],
    result: "pointer",
    nonblocking: false,
  },
  "xmlGetProp": {
    parameters: ["pointer", "pointer"],
    result: "pointer",
    nonblocking: false,
  },
});

const libc = Deno.dlopen("", {
  "free": {
    parameters: ["pointer"],
    result: "void",
    nonblocking: false,
  },
});

function cstr(s: string): Uint8Array {
  return new TextEncoder().encode(`${s}\0`);
}

function myDoc(ptr: Deno.UnsafePointer): Deno.UnsafePointer {
  const v = new Deno.UnsafePointerView(ptr);
  return new Deno.UnsafePointer(v.getBigUint64(16));
}

class PushParseCtxt {
  #ptr: Deno.UnsafePointer | "closed";

  constructor(chunk: Uint8Array) {
    this.#ptr = lib.symbols.xmlCreatePushParserCtxt(
      null,
      null,
      chunk,
      chunk.length,
      cstr("<mem>"),
    );
    if (!this.#ptr.value) {
      throw new Error(`${this.#ptr}`);
    }
  }

  add(chunk: Uint8Array) {
    if (this.#ptr === "closed") {
      throw new Error("closed");
    }
    const ret = lib.symbols.xmlParseChunk(this.#ptr, chunk, chunk.length, 0);
    if (ret) {
      // xmlParserErrors
      throw new Error(`${ret}`);
    }
  }

  finish(): Document {
    if (this.#ptr === "closed") {
      throw new Error("already finished.");
    }
    const ret = lib.symbols.xmlParseChunk(this.#ptr, null, 0, 1);
    if (ret) {
      // xmlParserErrors
      throw new Error(`${ret}`);
    }
    lib.symbols.xmlFreeParserCtxt(this.#ptr);
    const doc = myDoc(this.#ptr);
    this.#ptr = "closed";
    return new Document(doc);
  }
}

const getPtr = Symbol();

class Document {
  #ptr: Deno.UnsafePointer | "freed";

  constructor(ptr: Deno.UnsafePointer) {
    this.#ptr = ptr;
  }

  get [getPtr](): Deno.UnsafePointer {
    if (this.#ptr === "freed") {
      throw new Error("already freed");
    }
    return this.#ptr;
  }

  free() {
    if (this.#ptr === "freed") {
      return;
    }
    lib.symbols.xmlFreeDoc(this.#ptr);
    this.#ptr = "freed";
  }
}

export class XPathContext {
  #ptr: Deno.UnsafePointer | "freed";

  constructor(doc: Document) {
    this.#ptr = lib.symbols.xmlXPathNewContext(doc[getPtr]);
    if (!this.#ptr) {
      throw new Error(`${this.#ptr}`);
    }
  }

  evaluate(exp: string, node?: Node | undefined): Iterable<Node> {
    if (this.#ptr === "freed") {
      throw new Error("already freed.");
    }

    let obj: Deno.UnsafePointer;
    if (node) {
      obj = lib.symbols.xmlXPathNodeEval(
        (node as NodeImpl)[getPtr],
        cstr(exp),
        this.#ptr,
      );
    } else {
      obj = lib.symbols.xmlXPathEval(cstr(exp), this.#ptr);
    }
    if (!obj.value) {
      throw new Error("eval failed."); // TODO
    }

    return (function* () {
      try {
        const v = new Deno.UnsafePointerView(obj);
        const ty = v.getUint32(0);
        if (ty !== 1 /* XPATH_NODESET */) {
          throw new Error();
        }
        const nodesetval = new Deno.UnsafePointerView(
          new Deno.UnsafePointer(v.getBigUint64(8)),
        );
        const nodeNr = nodesetval.getInt32(0);
        //const nodeMax = nodesetval.getInt32(4);
        const nodeTab = new Deno.UnsafePointerView(
          new Deno.UnsafePointer(nodesetval.getBigUint64(8)),
        );
        const controller = new AbortController();
        try {
          for (let i = 0; i < nodeNr; i++) {
            const node = new Deno.UnsafePointer(nodeTab.getBigUint64(i * 8));
            yield new NodeImpl(controller.signal, node);
          }
        } finally {
          controller.abort();
        }
      } finally {
        lib.symbols.xmlXPathFreeObject(obj);
      }
    })();
  }

  free() {
    if (this.#ptr === "freed") {
      return;
    }
    lib.symbols.xmlXPathFreeContext(this.#ptr);
    this.#ptr = "freed";
  }
}

export const XML_ELEMENT_NODE = Symbol("XML_ELEMENT_NODE");
export const XML_ATTRIBUTE_NODE = Symbol("XML_ATTRIBUTE_NODE");
export const XML_TEXT_NODE = Symbol("XML_TEXT_NODE");
export const XML_CDATA_SECTION_NODE = Symbol("XML_CDATA_SECTION_NODE");
export const XML_ENTITY_REF_NODE = Symbol("XML_ENTITY_REF_NODE");
export const XML_ENTITY_NODE = Symbol("XML_ENTITY_NODE");
export const XML_PI_NODE = Symbol("XML_PI_NODE");
export const XML_COMMENT_NODE = Symbol("XML_COMMENT_NODE");
export const XML_DOCUMENT_NODE = Symbol("XML_DOCUMENT_NODE");
export const XML_DOCUMENT_TYPE_NODE = Symbol("XML_DOCUMENT_TYPE_NODE");
export const XML_DOCUMENT_FRAG_NODE = Symbol("XML_DOCUMENT_FRAG_NODE");
export const XML_NOTATION_NODE = Symbol("XML_NOTATION_NODE");
export const XML_HTML_DOCUMENT_NODE = Symbol("XML_HTML_DOCUMENT_NODE");
export const XML_DTD_NODE = Symbol("XML_DTD_NODE");
export const XML_ELEMENT_DECL = Symbol("XML_ELEMENT_DECL");
export const XML_ATTRIBUTE_DECL = Symbol("XML_ATTRIBUTE_DECL");
export const XML_ENTITY_DECL = Symbol("XML_ENTITY_DECL");
export const XML_NAMESPACE_DECL = Symbol("XML_NAMESPACE_DECL");
export const XML_XINCLUDE_START = Symbol("XML_XINCLUDE_START");
export const XML_XINCLUDE_END = Symbol("XML_XINCLUDE_END");
export const XML_DOCB_DOCUMENT_NODE = Symbol("XML_DOCB_DOCUMENT_NODE");

type ElementType =
  | typeof XML_ELEMENT_NODE
  | typeof XML_ATTRIBUTE_NODE
  | typeof XML_TEXT_NODE
  | typeof XML_CDATA_SECTION_NODE
  | typeof XML_ENTITY_REF_NODE
  | typeof XML_ENTITY_NODE
  | typeof XML_PI_NODE
  | typeof XML_COMMENT_NODE
  | typeof XML_DOCUMENT_NODE
  | typeof XML_DOCUMENT_TYPE_NODE
  | typeof XML_DOCUMENT_FRAG_NODE
  | typeof XML_NOTATION_NODE
  | typeof XML_HTML_DOCUMENT_NODE
  | typeof XML_DTD_NODE
  | typeof XML_ELEMENT_DECL
  | typeof XML_ATTRIBUTE_DECL
  | typeof XML_ENTITY_DECL
  | typeof XML_NAMESPACE_DECL
  | typeof XML_XINCLUDE_START
  | typeof XML_XINCLUDE_END
  | typeof XML_DOCB_DOCUMENT_NODE;

export type Element = {
  type: typeof XML_ELEMENT_NODE;
  tagName: string;
  textContent: string;
  attr(name: string): string | null;
};

export type Node = Element | {
  type: typeof XML_ATTRIBUTE_NODE;
} | {
  type: typeof XML_TEXT_NODE;
} | {
  type: typeof XML_CDATA_SECTION_NODE;
} | {
  type: typeof XML_ENTITY_REF_NODE;
} | {
  type: typeof XML_ENTITY_NODE;
} | {
  type: typeof XML_PI_NODE;
} | {
  type: typeof XML_COMMENT_NODE;
} | {
  type: typeof XML_DOCUMENT_NODE;
} | {
  type: typeof XML_DOCUMENT_TYPE_NODE;
} | {
  type: typeof XML_DOCUMENT_FRAG_NODE;
} | {
  type: typeof XML_NOTATION_NODE;
} | {
  type: typeof XML_HTML_DOCUMENT_NODE;
} | {
  type: typeof XML_DTD_NODE;
} | {
  type: typeof XML_ELEMENT_DECL;
} | {
  type: typeof XML_ATTRIBUTE_DECL;
} | {
  type: typeof XML_ENTITY_DECL;
} | {
  type: typeof XML_NAMESPACE_DECL;
} | {
  type: typeof XML_XINCLUDE_START;
} | {
  type: typeof XML_XINCLUDE_END;
} | {
  type: typeof XML_DOCB_DOCUMENT_NODE;
};

class NodeImpl {
  #signal: AbortSignal;
  #ptr: Deno.UnsafePointer;

  constructor(signal: AbortSignal, ptr: Deno.UnsafePointer) {
    this.#signal = signal;
    this.#ptr = ptr;
  }

  get [getPtr](): Deno.UnsafePointer {
    if (this.#signal.aborted) {
      throw new Error("dead");
    }
    return this.#ptr;
  }

  get type(): ElementType {
    if (this.#signal.aborted) {
      throw new Error("dead");
    }

    switch (new Deno.UnsafePointerView(this.#ptr).getInt32(8)) {
      case 1:
        return XML_ELEMENT_NODE;
      case 2:
        return XML_ATTRIBUTE_NODE;
      case 3:
        return XML_TEXT_NODE;
      case 4:
        return XML_CDATA_SECTION_NODE;
      case 5:
        return XML_ENTITY_REF_NODE;
      case 6:
        return XML_ENTITY_NODE;
      case 7:
        return XML_PI_NODE;
      case 8:
        return XML_COMMENT_NODE;
      case 9:
        return XML_DOCUMENT_NODE;
      case 10:
        return XML_DOCUMENT_TYPE_NODE;
      case 11:
        return XML_DOCUMENT_FRAG_NODE;
      case 12:
        return XML_NOTATION_NODE;
      case 13:
        return XML_HTML_DOCUMENT_NODE;
      case 14:
        return XML_DTD_NODE;
      case 15:
        return XML_ELEMENT_DECL;
      case 16:
        return XML_ATTRIBUTE_DECL;
      case 17:
        return XML_ENTITY_DECL;
      case 18:
        return XML_NAMESPACE_DECL;
      case 19:
        return XML_XINCLUDE_START;
      case 20:
        return XML_XINCLUDE_END;
      case 21:
        return XML_DOCB_DOCUMENT_NODE;
      default:
        throw new Error();
    }
  }

  get tagName(): string {
    if (this.#signal.aborted) {
      throw new Error("dead");
    }
    return new Deno.UnsafePointerView(
      new Deno.UnsafePointer(
        new Deno.UnsafePointerView(this.#ptr).getBigUint64(8 * 2),
      ),
    ).getCString();
  }

  get textContent(): string {
    if (this.#signal.aborted) {
      throw new Error("dead");
    }

    const r = lib.symbols.xmlNodeGetContent(this.#ptr);
    if (!r.value) {
      throw new Error();
    }
    try {
      return new Deno.UnsafePointerView(r).getCString();
    } finally {
      libc.symbols.free(r);
      // FIXME Calling xmlFree will cause SEGV. Why..?
      //lib.symbols.xmlFree(r);
    }
  }

  attr(name: string): string | null {
    if (this.#signal.aborted) {
      throw new Error("dead");
    }

    const r = lib.symbols.xmlGetProp(this.#ptr, cstr(name));
    if (!r.value) {
      return null;
    }
    try {
      return new Deno.UnsafePointerView(r).getCString();
    } finally {
      libc.symbols.free(r);
      // FIXME Calling xmlFree will cause SEGV. Why..?
      //lib.symbols.xmlFree(r);
    }
  }
}

export async function parseDocument(
  input: ReadableStream<Uint8Array>,
): Promise<Document> {
  const reader = input.getReader();
  try {
    let r = await reader.read();
    if (r.done) {
      throw new Error("unexpected EOF.");
    }

    const ctx = new PushParseCtxt(r.value);
    while (!r.done) {
      r = await reader.read();
      if (!r.value) {
        continue;
      }
      ctx.add(r.value);
    }
    return ctx.finish();
  } finally {
    reader.releaseLock();
  }
}
