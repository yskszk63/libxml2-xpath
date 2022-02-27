import { parseDocument, XPathContext, XML_ELEMENT_NODE } from "https://deno.land/x/libxml2_xpath/mod.ts";

const fp = (await Deno.open("/usr/share/xcb/xproto.xml")).readable;
try {
  const doc = await parseDocument(fp);
  try {
    const ctx = new XPathContext(doc);
    try {
      for (const node of ctx.evaluate("/xcb/*")) {
        if (node.type !== XML_ELEMENT_NODE) {
          continue;
        }
        console.log(node.tagName, node.attr("name"));
        if (node.tagName === "struct") {
          for (const item of ctx.evaluate("field", node)) {
            if (item.type !== XML_ELEMENT_NODE) {
              continue;
            }
            console.log("  ", item.tagName, item.attr("type"), item.attr("name"));
          }
        }
      }
    } finally {
      ctx.free();
    }
  } finally {
    doc.free();
  }
} catch(e) {
  await fp.cancel();
  throw e;
}
