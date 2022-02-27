import { assertEquals, fail, assertThrows, assertRejects } from "https://deno.land/std@0.127.0/testing/asserts.ts";

import { parseDocument, XPathContext, XML_ELEMENT_NODE, Node } from "./mod.ts";

Deno.test("Test parse simple content and query.", async () => {
  const xml = new Blob(['<item name="world!">hello</item>'], { type: "application/xml" });
  const response = await fetch(URL.createObjectURL(xml));
  if (response.body === null) {
    fail();
  }
  const doc = await parseDocument(response.body);
  try {
    const ctx = new XPathContext(doc);
    try {
      for (const item of ctx.evaluate("/item")) {
        if (item.type !== XML_ELEMENT_NODE) {
          fail();
        }
        assertEquals(item.tagName, "item");
        assertEquals(item.textContent, "hello");
        assertEquals(item.attr("name"), "world!");
        assertEquals(item.attr("x"), null);
      }
    } finally {
      ctx.free();
    }
  } finally {
    doc.free();
  }
});

Deno.test("Test nested lement.", async () => {
  const xml = new Blob(['<item><value>ok</value></item>'], { type: "application/xml" });
  const response = await fetch(URL.createObjectURL(xml));
  if (response.body === null) {
    fail();
  }
  const doc = await parseDocument(response.body);
  try {
    const ctx = new XPathContext(doc);
    try {
      for (const item of ctx.evaluate("/item")) {
        if (item.type !== XML_ELEMENT_NODE) {
          fail();
        }
        for (const value of ctx.evaluate("value", item)) {
          if (value.type !== XML_ELEMENT_NODE) {
            fail();
          }
          assertEquals(value.textContent, "ok");
        }
      }
    } finally {
      ctx.free();
    }
  } finally {
    doc.free();
  }
});

/*
Deno.test("Test large xml.", async () => {
  const response = await fetch("https://www.iana.org/assignments/media-types/media-types.xml");
  if (response.body === null) {
    fail();
  }
  const doc = await parseDocument(response.body);
  doc.free();
});
*/

Deno.test("Test free document after free.", async () => {
  const xml = new Blob(['<item/>'], { type: "application/xml" });
  const response = await fetch(URL.createObjectURL(xml));
  if (response.body === null) {
    fail();
  }
  const doc = await parseDocument(response.body);
  doc.free();
  doc.free();
});

Deno.test("Failure when use freed document.", async () => {
  const xml = new Blob(['<item/>'], { type: "application/xml" });
  const response = await fetch(URL.createObjectURL(xml));
  if (response.body === null) {
    fail();
  }
  const doc = await parseDocument(response.body);
  doc.free();

  assertThrows(() => new XPathContext(doc));
});

Deno.test("Failure invalid document.", async () => {
  const xml = new Blob(['<item>'], { type: "application/xml" });
  const response = await fetch(URL.createObjectURL(xml));
  if (response.body === null) {
    fail();
  }
  assertRejects(async () => await parseDocument(response.body!));
});

Deno.test("Failure invalid document2.", async () => {
  const xml = new Blob([], { type: "application/xml" });
  const response = await fetch(URL.createObjectURL(xml));
  if (response.body === null) {
    fail();
  }
  assertRejects(async () => await parseDocument(response.body!));
});

Deno.test("Fail when evaluate after freed.", async () => {
  const xml = new Blob(['<item/>'], { type: "application/xml" });
  const response = await fetch(URL.createObjectURL(xml));
  if (response.body === null) {
    fail();
  }
  const doc = await parseDocument(response.body);
  try {
    const ctx = new XPathContext(doc);
    ctx.free();
    assertThrows(() => ctx.evaluate("/item"));
  } finally {
    doc.free();
  }
});

Deno.test("Test free XPathContext after free.", async () => {
  const xml = new Blob(['<item/>'], { type: "application/xml" });
  const response = await fetch(URL.createObjectURL(xml));
  if (response.body === null) {
    fail();
  }
  const doc = await parseDocument(response.body);
  try {
    const ctx = new XPathContext(doc);
    ctx.free();
    ctx.free();
  } finally {
    doc.free();
  }
});

Deno.test("Test free XPathContext after free.", async () => {
  const xml = new Blob(['<item/>'], { type: "application/xml" });
  const response = await fetch(URL.createObjectURL(xml));
  if (response.body === null) {
    fail();
  }
  const doc = await parseDocument(response.body);
  try {
    const ctx = new XPathContext(doc);
    ctx.free();
    ctx.free();
  } finally {
    doc.free();
  }
});

Deno.test("Fail use node outer loop.", async () => {
  const xml = new Blob(['<item/>'], { type: "application/xml" });
  const response = await fetch(URL.createObjectURL(xml));
  if (response.body === null) {
    fail();
  }
  const doc = await parseDocument(response.body);
  try {
    const ctx = new XPathContext(doc);
    try {
      let element: Node | null = null;
      for (const item of ctx.evaluate("/item")) {
        if (item.type !== XML_ELEMENT_NODE) {
          continue;
        }
        element = item;
      }
      if (element === null) {
        fail();
      }

      assertThrows(() => (element as any).type);
      assertThrows(() => (element as any).tagName);
      assertThrows(() => (element as any).textContent);
      assertThrows(() => (element as any).attr(""));
      assertThrows(() => ctx.evaluate(".", element!));
    } finally {
      ctx.free();
    }
  } finally {
    doc.free();
  }
});

