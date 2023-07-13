function GM_bootstrap() {
  const row = /\/\/\s+@(\S+)\s+(.+)/g;
  const meta = GM_info.script;
  if (typeof meta.code != "function") {
    return;
  }
  let match;
  while ((match = row.exec(GM_info.scriptMetaStr)) !== null) {
    if (meta[match[1]]) {
      if (typeof meta[match[1]] == "string") meta[match[1]] = [meta[match[1]]];
      meta[match[1]].push(match[2]);
    } else meta[match[1]] = match[2];
  }
  meta.includes = meta.include || [];
  meta.matches = meta.match || [];
  meta.excludes = meta.exclude || [];
  meta.requires =
    typeof meta.require == "string" ? [meta.require] : meta.require || [];
  meta.grants =
    typeof meta.grants == "string" ? [meta.grant] : meta.grant || [];
  meta["run-at"] = Array.isArray(meta["run-at"])
    ? meta["run-at"][0]
    : meta["run-at"] || "document-idle";
  delete meta.include;
  delete meta.match;
  delete meta.exclude;
  delete meta.require;
  delete meta.resource;
  delete meta.grant;

  if (
    meta.grants.includes("GM.xmlHttpRequest") &&
    meta.grants.includes("GM_xmlhttpRequest")
  ) {
    GM.xmlHttpRequest = async (details) => {
      return await new Promise((resolve, error) => {
        const onload = details.onload;
        const onerror = details.onerror;
        details.onload = (d) => {
          if (typeof onload == "function") onload(d);
          resolve(d);
        };
        details.onerror = (e) => {
          if (typeof onerror == "function") onerror(e);
          error(e);
        };
        GM_xmlhttpRequest(details);
      });
    };
  }

  if (
    meta.grants.includes("GM_setValue") ||
    meta.grants.includes("GM_getValue") ||
    meta.grants.includes("GM.getValue") ||
    meta.grants.includes("GM_listValues")
  ) {
    GM_info.storage = {};
    window.addEventListener("scriptStorage", (e) => {
      if (e.detail.id != GM_info.script.id) {
        return;
      }
      e.stopImmediatePropagation();
      const data = e.detail.data;
      if ("init" in data) {
        GM_info.storage = data.init;
        runScript(meta);
        return;
      }
      if ("key" in data && data.key in GM_info.storage) {
        GM_info.valueListener.forEach((e) => {
          if (e.enabled == true && e.key == data.key) {
            e.listener(
              GM_info.storage[data.key] || null,
              data.value,
              e.detail.uuid != GM_info.uuid
            );
          }
        });
      }
      GM_info.storage[data.key] = data.value;
    });
    GM_info.valueListener = [];

    const valueAsked = [];
    GM.getValue = async function (key) {
      const id = Math.random();
      if (!valueAsked.includes(key)) {
        valueAsked.push(key);
        return GM_info.storage[key];
      }
      scriptStorage({ key, id, broadcast: false });
      return await new Promise((resolve) => {
        const tmpListner = (e) => {
          if (
            e.detail.id != GM_info.script.id &&
            e.detail.uuid == GM_info.uuid
          ) {
            return;
          }
          const data = e.detail.data;
          if (data.id == id && data.key == key) {
            e.stopImmediatePropagation();
            GM_info.storage[key] = data.value;
            window.removeEventListener("scriptSyncValue", tmpListner);
            resolve(data.value);
          }
        };
        window.addEventListener("scriptSyncValue", tmpListner);
      });
    };
  } else {
    runScript(meta);
  }
}

function scriptStorage(data) {
  let broadcast = GM_info.script.grants.includes("GM_addValueChangeListener");
  if ("broadcast" in data && !data.broadcast) {
    broadcast = false;
    delete data.broadcast;
  }
  ChromeXt(
    JSON.stringify({
      action: "scriptStorage",
      payload: {
        id: GM_info.script.id,
        data,
        uuid: GM_info.uuid,
        broadcast,
      },
    })
  );
}

function runScript(meta) {
  if (meta.requires.length > 0) {
    meta.sync_code = meta.code;
    meta.code = async () => {
      for (const url of meta.requires) {
        try {
          await import(url);
        } catch {
          GM_addElement("script", {
            textContent: await new Promise((resolve, reject) => {
              GM_xmlhttpRequest({
                url,
                onload: (res) => resolve(res.responseText),
                onerror: (e) => reject(e),
                ontimeout: (e) => reject(e),
              });
            }),
          });
        }
      }
      meta.sync_code();
    };
  }

  switch (meta["run-at"]) {
    case "document-start":
      meta.code();
      break;
    case "document-end":
      if (document.readyState != "loading") {
        meta.code();
      } else {
        window.addEventListener("DOMContentLoaded", meta.code);
      }
      break;
    default:
      if (document.readyState == "complete") {
        meta.code();
      } else {
        window.addEventListener("load", meta.code);
      }
  }

  GM_info.uuid = Math.random();
  GM_info.scriptHandler = "ChromeXt";
  GM_info.version = "3.4.0";
  if (typeof ChromeXt.scripts == "undefined") {
    ChromeXt.scripts = [];
  }
  ChromeXt.scripts.push(GM_info);
}

const globalThis =
  typeof unsafeWindow != "undefined"
    ? unsafeWindow
    : new Proxy(window, {
        get(target, prop) {
          if (prop.startsWith("_")) {
            return undefined;
          } else {
            let value = target[prop];
            return typeof value === "function" ? value.bind(target) : value;
          }
        },
      });
// Kotlin separator

function GM_addStyle(css) {
  const style = document.createElement("style");
  style.setAttribute("type", "text/css");
  style.textContent = css;
  try {
    (document.head || document.documentElement).appendChild(style);
  } catch {
    setTimeout(() => {
      document.head.appendChild(style);
    }, 0);
  }
  return style;
}
// Kotlin separator

function GM_removeValueChangeListener(index) {
  GM_info.valueListener[index].enabled = false;
}
// Kotlin separator

function GM_unregisterMenuCommand(index) {
  ChromeXt.commands[index].enabled = false;
}
// Kotlin separator

function GM_addElement() {
  // arguments: parent_node, tag_name, attributes
  if (arguments.length == 2) {
    arguments = [document.head, arguments[0], arguments[1]];
  }
  if (arguments.length != 3) {
    return;
  }
  const element = document.createElement(arguments[1]);
  for (const [key, value] of Object.entries(arguments[2])) {
    if (key != "textContent") {
      element.setAttribute(key, value);
    } else {
      element.textContent = value;
    }
  }
  try {
    arguments[0].appendChild(element);
  } catch {
    setTimeout(() => {
      document.head.appendChild(element);
    }, 0);
  }
  return element;
}
// Kotlin separator

function GM_download(details) {
  if (arguments.length == 2) {
    details = { url: arguments[0], name: arguments[1] };
  }
  return GM_xmlhttpRequest({
    ...details,
    responseType: "blob",
    onload: (res) => {
      if (res.status !== 200)
        return console.error("Error loading: ", details.url, res);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(res.response);
      link.download =
        details.name ||
        details.url.split("#").shift().split("?").shift().split("/").pop();
      link.dispatchEvent(new MouseEvent("click"));
      setTimeout(URL.revokeObjectURL(link.href), 1000);
    },
  });
}
// Kotlin separator

function GM_openInTab(url, options) {
  const gm_window = window.open(url, "_blank");
  if (typeof options == "boolean") {
    options = { active: !options };
  }
  if ("active" in options && options.active) {
    gm_window.focus();
  }
  return gm_window;
}
// Kotlin separator

function GM_registerMenuCommand(title, listener, _accessKey = "Dummy") {
  if (typeof ChromeXt.commands == "undefined") {
    ChromeXt.commands = [];
  }
  const index = ChromeXt.commands.findIndex(
    (e) => e.id == GM_info.script.id && e.title == title
  );
  if (index != -1) {
    ChromeXt.commands[index].listener = listener;
    return index;
  }
  ChromeXt.commands.push({
    id: GM_info.script.id,
    title,
    listener,
    enabled: true,
  });
  return ChromeXt.commands.length - 1;
}
// Kotlin separator

function GM_addValueChangeListener(key, listener) {
  const index = GM_info.valueListener.findIndex((e) => e.key == key);
  if (index != -1) {
    GM_info.valueListener[index].listener = listener;
    return index;
  }
  GM_info.valueListener.push({ key, listener, enabled: true });
  return GM_info.valueListener.length - 1;
}
// Kotlin separator

function GM_setValue(key, value) {
  GM_info.storage[key] = value;
  scriptStorage({ key, value });
}
// Kotlin separator

function GM_deleteValue(key) {
  if (key in GM_info.storage) {
    delete GM_info.storage[key];
    scriptStorage({ key, delete: true });
  }
}
// Kotlin separator

function GM_getValue(key, default_value) {
  return GM_info.storage[key] || default_value;
}
// Kotlin separator

function GM_listValues() {
  return Object.keys(GM_info.storage);
}
// Kotlin separator

function GM_getResourceText(name) {
  return (
    GM_info.script.resources.find((it) => it.name == name).content ||
    "ChromeXt failed to find resource " + name
  );
}
// Kotlin separator

function GM_getResourceURL(name) {
  return (
    GM_info.script.resources.find((it) => it.name == name).url ||
    "ChromeXt failed to find resource " + name
  );
}
// Kotlin separator

function GM_xmlhttpRequest(details) {
  if (!details.url) {
    throw new Error("GM_xmlhttpRequest requires a URL.");
  }
  const uuid = Math.random();
  details.method = details.method ? details.method.toUpperCase() : "GET";

  if (
    "data" in details &&
    details.data != null &&
    typeof details.data != "string"
  ) {
    details.binary = true;
  }

  if ("binary" in details && "data" in details && details.binary) {
    switch (details.data.constructor) {
      case File:
      case Blob:
        details.data = details.data.arrayBuffer();
      case ArrayBuffer:
        details.data = new Uint8Array(details.data);
      case Uint8Array:
        data = bytesToBase64(data);
        break;
      default:
        details.binary = false;
    }
  }

  if (
    !(
      "headers" in details &&
      ("User-Agent" in details.headers || "user-agent" in details.headers)
    )
  ) {
    details.headers = details.headers || {};
    details.headers["User-Agent"] = window.navigator.userAgent;
  }

  ChromeXt(
    JSON.stringify({
      action: "xmlhttpRequest",
      payload: { id: GM_info.script.id, request: details, uuid },
    })
  );

  function bytesToBase64(bytes) {
    const binString = Array.from(bytes, (x) => String.fromCodePoint(x)).join(
      ""
    );
    return btoa(binString);
  }

  const tmpListner = (e) => {
    if (e.detail.id == GM_info.script.id && e.detail.uuid == uuid) {
      e.stopImmediatePropagation();
      let data = e.detail.data;
      data.context = details.context;
      if (data.responseHeaders) {
        data.finalUrl = data.responseHeaders.Location || details.url;
        data.total = data.responseHeaders["Content-Length"];
      }
      switch (e.detail.type) {
        case "load":
          data.readyState = 4;
          if ("overrideMimeType" in details)
            data.responseHeaders["Content-Type"] = details.overrideMimeType;
          if ([101, 204, 205, 304].includes(data.status)) {
            data.response = null;
          }

          data.responseText = data.response;
          if (
            data.response != null &&
            "responseType" in details &&
            !["", "text", "document", "json"].includes(details.responseType)
          ) {
            const arraybuffer = Uint8Array.from(atob(data.response), (m) =>
              m.codePointAt(0)
            ).buffer;
            const type = data.responseHeaders["Content-Type"] || "";
            const blob = new Blob([arraybuffer], { type });
            switch (details.responseType) {
              case "arraybuffer":
                data.response = arraybuffer;
                break;
              case "blob":
                data.response = blob;
                break;
              case "stream":
                data.response = blob.stream();
                break;
              default:
            }
          }
          details.onload(data);
          e.detail.type = "loadend";
        default:
          if (typeof details["on" + e.detail.type] == "function") {
            details["on" + e.detail.type](data);
          }
          if (["loadend", "error"].includes(e.detail.type)) {
            window.removeEventListener("xmlhttpRequest", tmpListner);
          }
      }
    }
  };
  window.addEventListener("xmlhttpRequest", tmpListner);

  return {
    abort: () => {
      ChromeXt(JSON.stringify({ action: "abortRequest", payload: uuid }));
    },
  };
}
