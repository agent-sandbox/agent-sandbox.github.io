var AsciinemaPlayer = (function (exports) {
  'use strict';

  function parseNpt(time) {
    if (typeof time === "number") {
      return time;
    } else if (typeof time === "string") {
      return time.split(":").reverse().map(parseFloat).reduce((sum, n, i) => sum + n * Math.pow(60, i));
    } else {
      return undefined;
    }
  }
  function debounce(f, delay) {
    let timeout;
    return function () {
      for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }
      clearTimeout(timeout);
      timeout = setTimeout(() => f.apply(this, args), delay);
    };
  }
  function throttle(f, interval) {
    let enableCall = true;
    return function () {
      if (!enableCall) return;
      enableCall = false;
      for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
      }
      f.apply(this, args);
      setTimeout(() => enableCall = true, interval);
    };
  }

  class DummyLogger {
    log() {}
    debug() {}
    info() {}
    warn() {}
    error() {}
  }
  class PrefixedLogger {
    constructor(logger, prefix) {
      this.logger = logger;
      this.prefix = prefix;
    }
    log(message) {
      for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        args[_key - 1] = arguments[_key];
      }
      this.logger.log(`${this.prefix}${message}`, ...args);
    }
    debug(message) {
      for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        args[_key2 - 1] = arguments[_key2];
      }
      this.logger.debug(`${this.prefix}${message}`, ...args);
    }
    info(message) {
      for (var _len3 = arguments.length, args = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
        args[_key3 - 1] = arguments[_key3];
      }
      this.logger.info(`${this.prefix}${message}`, ...args);
    }
    warn(message) {
      for (var _len4 = arguments.length, args = new Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
        args[_key4 - 1] = arguments[_key4];
      }
      this.logger.warn(`${this.prefix}${message}`, ...args);
    }
    error(message) {
      for (var _len5 = arguments.length, args = new Array(_len5 > 1 ? _len5 - 1 : 0), _key5 = 1; _key5 < _len5; _key5++) {
        args[_key5 - 1] = arguments[_key5];
      }
      this.logger.error(`${this.prefix}${message}`, ...args);
    }
  }

  let wasm;
  const heap = new Array(128).fill(undefined);
  heap.push(undefined, null, true, false);
  function getObject(idx) {
    return heap[idx];
  }
  function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
      return `${val}`;
    }
    if (type == 'string') {
      return `"${val}"`;
    }
    if (type == 'symbol') {
      const description = val.description;
      if (description == null) {
        return 'Symbol';
      } else {
        return `Symbol(${description})`;
      }
    }
    if (type == 'function') {
      const name = val.name;
      if (typeof name == 'string' && name.length > 0) {
        return `Function(${name})`;
      } else {
        return 'Function';
      }
    }
    // objects
    if (Array.isArray(val)) {
      const length = val.length;
      let debug = '[';
      if (length > 0) {
        debug += debugString(val[0]);
      }
      for (let i = 1; i < length; i++) {
        debug += ', ' + debugString(val[i]);
      }
      debug += ']';
      return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches.length > 1) {
      className = builtInMatches[1];
    } else {
      // Failed to match the standard '[object ClassName]'
      return toString.call(val);
    }
    if (className == 'Object') {
      // we're a user defined class or Object
      // JSON.stringify avoids problems with cycles, and is generally much
      // easier than looping through ownProperties of `val`.
      try {
        return 'Object(' + JSON.stringify(val) + ')';
      } catch (_) {
        return 'Object';
      }
    }
    // errors
    if (val instanceof Error) {
      return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
  }
  let WASM_VECTOR_LEN = 0;
  let cachedUint8Memory0 = null;
  function getUint8Memory0() {
    if (cachedUint8Memory0 === null || cachedUint8Memory0.byteLength === 0) {
      cachedUint8Memory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8Memory0;
  }
  const cachedTextEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder('utf-8') : {
    encode: () => {
      throw Error('TextEncoder not available');
    }
  };
  const encodeString = typeof cachedTextEncoder.encodeInto === 'function' ? function (arg, view) {
    return cachedTextEncoder.encodeInto(arg, view);
  } : function (arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
      read: arg.length,
      written: buf.length
    };
  };
  function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
      const buf = cachedTextEncoder.encode(arg);
      const ptr = malloc(buf.length, 1) >>> 0;
      getUint8Memory0().subarray(ptr, ptr + buf.length).set(buf);
      WASM_VECTOR_LEN = buf.length;
      return ptr;
    }
    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;
    const mem = getUint8Memory0();
    let offset = 0;
    for (; offset < len; offset++) {
      const code = arg.charCodeAt(offset);
      if (code > 0x7F) break;
      mem[ptr + offset] = code;
    }
    if (offset !== len) {
      if (offset !== 0) {
        arg = arg.slice(offset);
      }
      ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
      const view = getUint8Memory0().subarray(ptr + offset, ptr + len);
      const ret = encodeString(arg, view);
      offset += ret.written;
      ptr = realloc(ptr, len, offset, 1) >>> 0;
    }
    WASM_VECTOR_LEN = offset;
    return ptr;
  }
  let cachedInt32Memory0 = null;
  function getInt32Memory0() {
    if (cachedInt32Memory0 === null || cachedInt32Memory0.byteLength === 0) {
      cachedInt32Memory0 = new Int32Array(wasm.memory.buffer);
    }
    return cachedInt32Memory0;
  }
  let heap_next = heap.length;
  function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];
    heap[idx] = obj;
    return idx;
  }
  const cachedTextDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', {
    ignoreBOM: true,
    fatal: true
  }) : {
    decode: () => {
      throw Error('TextDecoder not available');
    }
  };
  if (typeof TextDecoder !== 'undefined') {
    cachedTextDecoder.decode();
  }
  function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len));
  }
  function dropObject(idx) {
    if (idx < 132) return;
    heap[idx] = heap_next;
    heap_next = idx;
  }
  function takeObject(idx) {
    const ret = getObject(idx);
    dropObject(idx);
    return ret;
  }
  /**
  * @param {number} cols
  * @param {number} rows
  * @param {number} scrollback_limit
  * @returns {Vt}
  */
  function create$1(cols, rows, scrollback_limit) {
    const ret = wasm.create(cols, rows, scrollback_limit);
    return Vt.__wrap(ret);
  }
  let cachedUint32Memory0 = null;
  function getUint32Memory0() {
    if (cachedUint32Memory0 === null || cachedUint32Memory0.byteLength === 0) {
      cachedUint32Memory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32Memory0;
  }
  function getArrayU32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint32Memory0().subarray(ptr / 4, ptr / 4 + len);
  }
  const VtFinalization = typeof FinalizationRegistry === 'undefined' ? {
    register: () => {},
    unregister: () => {}
  } : new FinalizationRegistry(ptr => wasm.__wbg_vt_free(ptr >>> 0));
  /**
  */
  class Vt {
    static __wrap(ptr) {
      ptr = ptr >>> 0;
      const obj = Object.create(Vt.prototype);
      obj.__wbg_ptr = ptr;
      VtFinalization.register(obj, obj.__wbg_ptr, obj);
      return obj;
    }
    __destroy_into_raw() {
      const ptr = this.__wbg_ptr;
      this.__wbg_ptr = 0;
      VtFinalization.unregister(this);
      return ptr;
    }
    free() {
      const ptr = this.__destroy_into_raw();
      wasm.__wbg_vt_free(ptr);
    }
    /**
    * @param {string} s
    * @returns {any}
    */
    feed(s) {
      const ptr0 = passStringToWasm0(s, wasm.__wbindgen_export_0, wasm.__wbindgen_export_1);
      const len0 = WASM_VECTOR_LEN;
      const ret = wasm.vt_feed(this.__wbg_ptr, ptr0, len0);
      return takeObject(ret);
    }
    /**
    * @param {number} cols
    * @param {number} rows
    * @returns {any}
    */
    resize(cols, rows) {
      const ret = wasm.vt_resize(this.__wbg_ptr, cols, rows);
      return takeObject(ret);
    }
    /**
    * @returns {Uint32Array}
    */
    getSize() {
      try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        wasm.vt_getSize(retptr, this.__wbg_ptr);
        var r0 = getInt32Memory0()[retptr / 4 + 0];
        var r1 = getInt32Memory0()[retptr / 4 + 1];
        var v1 = getArrayU32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export_2(r0, r1 * 4, 4);
        return v1;
      } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
      }
    }
    /**
    * @param {number} n
    * @returns {any}
    */
    getLine(n) {
      const ret = wasm.vt_getLine(this.__wbg_ptr, n);
      return takeObject(ret);
    }
    /**
    * @returns {any}
    */
    getCursor() {
      const ret = wasm.vt_getCursor(this.__wbg_ptr);
      return takeObject(ret);
    }
  }
  async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
      if (typeof WebAssembly.instantiateStreaming === 'function') {
        try {
          return await WebAssembly.instantiateStreaming(module, imports);
        } catch (e) {
          if (module.headers.get('Content-Type') != 'application/wasm') {
            console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);
          } else {
            throw e;
          }
        }
      }
      const bytes = await module.arrayBuffer();
      return await WebAssembly.instantiate(bytes, imports);
    } else {
      const instance = await WebAssembly.instantiate(module, imports);
      if (instance instanceof WebAssembly.Instance) {
        return {
          instance,
          module
        };
      } else {
        return instance;
      }
    }
  }
  function __wbg_get_imports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbindgen_is_string = function (arg0) {
      const ret = typeof getObject(arg0) === 'string';
      return ret;
    };
    imports.wbg.__wbg_new_b525de17f44a8943 = function () {
      const ret = new Array();
      return addHeapObject(ret);
    };
    imports.wbg.__wbg_set_17224bc548dd1d7b = function (arg0, arg1, arg2) {
      getObject(arg0)[arg1 >>> 0] = takeObject(arg2);
    };
    imports.wbg.__wbindgen_debug_string = function (arg0, arg1) {
      const ret = debugString(getObject(arg1));
      const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_export_0, wasm.__wbindgen_export_1);
      const len1 = WASM_VECTOR_LEN;
      getInt32Memory0()[arg0 / 4 + 1] = len1;
      getInt32Memory0()[arg0 / 4 + 0] = ptr1;
    };
    imports.wbg.__wbindgen_number_new = function (arg0) {
      const ret = arg0;
      return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_bigint_from_u64 = function (arg0) {
      const ret = BigInt.asUintN(64, arg0);
      return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_error_new = function (arg0, arg1) {
      const ret = new Error(getStringFromWasm0(arg0, arg1));
      return addHeapObject(ret);
    };
    imports.wbg.__wbg_new_f9876326328f45ed = function () {
      const ret = new Object();
      return addHeapObject(ret);
    };
    imports.wbg.__wbg_set_f975102236d3c502 = function (arg0, arg1, arg2) {
      getObject(arg0)[takeObject(arg1)] = takeObject(arg2);
    };
    imports.wbg.__wbg_new_f841cc6f2098f4b5 = function () {
      const ret = new Map();
      return addHeapObject(ret);
    };
    imports.wbg.__wbg_set_388c4c6422704173 = function (arg0, arg1, arg2) {
      const ret = getObject(arg0).set(getObject(arg1), getObject(arg2));
      return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_object_drop_ref = function (arg0) {
      takeObject(arg0);
    };
    imports.wbg.__wbindgen_string_new = function (arg0, arg1) {
      const ret = getStringFromWasm0(arg0, arg1);
      return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_object_clone_ref = function (arg0) {
      const ret = getObject(arg0);
      return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_throw = function (arg0, arg1) {
      throw new Error(getStringFromWasm0(arg0, arg1));
    };
    return imports;
  }
  function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    __wbg_init.__wbindgen_wasm_module = module;
    cachedInt32Memory0 = null;
    cachedUint32Memory0 = null;
    cachedUint8Memory0 = null;
    return wasm;
  }
  function initSync(module) {
    if (wasm !== undefined) return wasm;
    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
      module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
  }
  async function __wbg_init(input) {
    if (wasm !== undefined) return wasm;
    const imports = __wbg_get_imports();
    if (typeof input === 'string' || typeof Request === 'function' && input instanceof Request || typeof URL === 'function' && input instanceof URL) {
      input = fetch(input);
    }
    const {
      instance,
      module
    } = await __wbg_load(await input, imports);
    return __wbg_finalize_init(instance, module);
  }

  var exports$1 = /*#__PURE__*/Object.freeze({
      __proto__: null,
      Vt: Vt,
      create: create$1,
      default: __wbg_init,
      initSync: initSync
  });

  const base64codes = [62,0,0,0,63,52,53,54,55,56,57,58,59,60,61,0,0,0,0,0,0,0,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,0,0,0,0,0,0,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51];

          function getBase64Code(charCode) {
              return base64codes[charCode - 43];
          }

          function base64_decode(str) {
              let missingOctets = str.endsWith("==") ? 2 : str.endsWith("=") ? 1 : 0;
              let n = str.length;
              let result = new Uint8Array(3 * (n / 4));
              let buffer;

              for (let i = 0, j = 0; i < n; i += 4, j += 3) {
                  buffer =
                      getBase64Code(str.charCodeAt(i)) << 18 |
                      getBase64Code(str.charCodeAt(i + 1)) << 12 |
                      getBase64Code(str.charCodeAt(i + 2)) << 6 |
                      getBase64Code(str.charCodeAt(i + 3));
                  result[j] = buffer >> 16;
                  result[j + 1] = (buffer >> 8) & 0xFF;
                  result[j + 2] = buffer & 0xFF;
              }

              return result.subarray(0, result.length - missingOctets);
          }

          const wasm_code = base64_decode("AGFzbQEAAAABjAEVYAJ/fwBgA39/fwBgAn9/AX9gA39/fwF/YAF/AGAEf39/fwBgAX8Bf2AFf39/f38AYAV/f39/fwF/YAZ/f39/f38AYAABf2AEf39/fwF/YAZ/f39/f38Bf2ABfAF/YAF+AX9gA39/fgF/YAR/f39+AGAFf39+f38AYAV/f31/fwBgBX9/fH9/AGAAAALOAw8Dd2JnFF9fd2JpbmRnZW5faXNfc3RyaW5nAAYDd2JnGl9fd2JnX25ld19iNTI1ZGUxN2Y0NGE4OTQzAAoDd2JnGl9fd2JnX3NldF8xNzIyNGJjNTQ4ZGQxZDdiAAEDd2JnF19fd2JpbmRnZW5fZGVidWdfc3RyaW5nAAADd2JnFV9fd2JpbmRnZW5fbnVtYmVyX25ldwANA3diZxpfX3diaW5kZ2VuX2JpZ2ludF9mcm9tX3U2NAAOA3diZxRfX3diaW5kZ2VuX2Vycm9yX25ldwACA3diZxpfX3diZ19uZXdfZjk4NzYzMjYzMjhmNDVlZAAKA3diZxpfX3diZ19zZXRfZjk3NTEwMjIzNmQzYzUwMgABA3diZxpfX3diZ19uZXdfZjg0MWNjNmYyMDk4ZjRiNQAKA3diZxpfX3diZ19zZXRfMzg4YzRjNjQyMjcwNDE3MwADA3diZxpfX3diaW5kZ2VuX29iamVjdF9kcm9wX3JlZgAEA3diZxVfX3diaW5kZ2VuX3N0cmluZ19uZXcAAgN3YmcbX193YmluZGdlbl9vYmplY3RfY2xvbmVfcmVmAAYDd2JnEF9fd2JpbmRnZW5fdGhyb3cAAAPOAcwBAwIAAQMABAEIAQMDCAMBCAcDCQIABwAJAQICAAMBCQcBAQUBAQQBAQAFBgUFAgUAAAICAwcFAQABCQUDBQIBBAEHAA8CBQQABgEBAQAGDAYBAQAFAAABBAYBAgQBAAcAAwEEEAcCAAEACQcDBAEEAAEAAAAABQIKAQAIAgABAgQLBwEHCwAAAAAAAQQABAABAAAACwELDBEHCBITBgUFAgMABAUEBAQEAQIAAgIBAQQEBAECAgAAAAACAQEBBAYAFAICAAQAAAQCBgIGBAUBcAEuLgUDAQASBgkBfwFBgIDAAAsHygEMBm1lbW9yeQIADV9fd2JnX3Z0X2ZyZWUAVQZjcmVhdGUAKwd2dF9mZWVkAA8JdnRfcmVzaXplAEIKdnRfZ2V0U2l6ZQA/CnZ0X2dldExpbmUAEAx2dF9nZXRDdXJzb3IAORNfX3diaW5kZ2VuX2V4cG9ydF8wAIUBE19fd2JpbmRnZW5fZXhwb3J0XzEAkwEfX193YmluZGdlbl9hZGRfdG9fc3RhY2tfcG9pbnRlcgDNARNfX3diaW5kZ2VuX2V4cG9ydF8yAL0BCVQBAEEBCy3DAdgB2gFU1wFL2QFMwgHIASm7AagBpQFIpwGoAa8BrQGnAacBqQGqAaYB1QHSAdMBPLEBeijQAbgB1AHGAboBwQHWAYEBoQFTaxx00QEMASMKlO0CzAG1NQERfyMAQaABayIFJAAgBUEwaiAAEIgBIAEgAmohDyAFKAIwIgNB3ABqIQ0gA0HQAGohDiADQTBqIRAgA0EkaiERIANBDGohEiADQbIBaiEIIANBxAFqIQogBSgCNCETIAEhCwNAAkACQAJAAkACQAJAIAMCfwJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkAgCyAPRg0AAn8gCywAACIAQQBOBEAgAEH/AXEhACALQQFqDAELIAstAAFBP3EhBiAAQR9xIQQgAEFfTQRAIARBBnQgBnIhACALQQJqDAELIAstAAJBP3EgBkEGdHIhBiAAQXBJBEAgBiAEQQx0ciEAIAtBA2oMAQsgBEESdEGAgPAAcSALLQADQT9xIAZBBnRyciIAQYCAxABGDQEgC0EEagshC0HBACAAIABBnwFLGyEEAkACQAJAIAMtAMwFIgcOBQAEBAQBBAsgBEEga0HgAEkNAQwDCyAEQTBrQQxPDQIMIAsgBSAANgJAIAVBIToAPAwCCyAFQfAAaiILIANB4ABqKAIAIANB5ABqKAIAECcgBUEQaiADECogBSAFKQMQNwJ8IAVBCGogBSgCdCAFKAJ4EGggBSgCDCEAIAUoAghBAXFFBEAgCxB7IAIEQCABQQEgAhBFCyATQQA2AgAgBUGgAWokACAADwsgBSAANgJMQaiAwABBKyAFQcwAakGYgMAAQeiCxAAQUAALAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAIARB/wFxIgZBG0cEQCAGQdsARg0BIAcODQMEBQYHDggODg4CDgkOCyADQQE6AMwFIAoQNAxUCyAHDg0BIwMEBQ0GDQ0NAA0HDQsgBEEga0HfAEkNUgwLCwJAIARBGEkNACAEQRlGDQAgBEH8AXFBHEcNCwsgBUE8aiAAEFYMMgsgBEHwAXFBIEYNBiAEQTBrQSBJDQggBEHRAGtBB0kNCAJAIAZB2QBrDgUJCQAJHwALIARB4ABrQR9PDQkMCAsgBEEwa0HPAE8NCCADQQA6AMwFIAVBPGogCiAAEDUMMAsgBEEvSwRAIARBO0cgBEE6T3FFBEAgA0EEOgDMBQxPCyAEQUBqQT9JDQQLIARB/AFxQTxHDQcgAyAANgLEASADQQQ6AMwFDE4LIARBQGpBP0kNBCAEQfwBcUE8Rw0GDEsLIARBQGpBP08NBQxJCyAEQSBrQeAASQ1LAkAgBkEYaw4DBwYHAAsgBkGZAWtBAkkNBiAGQdAARg1LIAZBB0YNSAwFCyADQQA6AMwFIAVBPGogCiAAEBIMKwsgAyAANgLEASADQQI6AMwFDEkLIANBADoAzAUgBUE8aiAKIAAQEgwpCyADQQA6AMwFIAVBPGogCiAAEDUMKAsCQCAGQRhrDgMCAQIACyAGQZkBa0ECSQ0BIAZB0ABHDQAgB0EBaw4KFQMICQokCwwNDkYLIARB8AFxIglBgAFGDQAgBEGRAWtBBksNAQsgA0EAOgDMBSAFQTxqIAAQVgwlCyAJQSBHDQEgB0EERw0BDD8LIARB8AFxIQkMAQsgB0EBaw4KAQADBAUOBgcICQ4LIAlBIEcNAQw7CyAEQRhPDQoMCwsCQCAEQRhJDQAgBEEZRg0AIARB/AFxQRxHDQwLIAVBPGogABBWDB8LAkACQCAEQRhJDQAgBEEZRg0AIARB/AFxQRxHDQELIAVBPGogABBWDB8LIARB8AFxQSBGDTkMCgsCQCAEQRhJDQAgBEEZRg0AIARB/AFxQRxHDQoLIAVBPGogABBWDB0LIARBQGpBP08EQCAEQfABcSIJQSBGDTcgCUEwRg06DAkLIANBADoAzAUgBUE8aiAKIAAQEgwcCyAEQfwBcUE8Rg0DIARB8AFxQSBGDS8gBEFAakE/Tw0HDAQLIARBL00NBiAEQTpJDTggBEE7Rg04IARBQGpBPk0NAwwGCyAEQUBqQT9JDQIMBQsgBEEYSQ03IARBGUYNNyAEQfwBcUEcRg03DAQLIAMgADYCxAEgA0EIOgDMBQw2CyADQQo6AMwFDDULIAZB2ABrIglBB01BAEEBIAl0QcEBcRsNBSAGQRlGDQAgBEH8AXFBHEcNAQsgBUE8aiAAEFYMFAsgBkGQAWsOEAEFBQUFBQUFAwUFAi8AAwMECyADQQw6AMwFDDELIANBBzoAzAUgChA0DDALIANBAzoAzAUgChA0DC8LIANBDToAzAUMLgsCQCAGQTprDgIEAgALIAZBGUYNAgsgB0EDaw4HCSwDCgULBywLIAdBA2sOBwgrKwkFCgcrCyAHQQNrDgcHKgIIKgkGKgsgB0EDaw4HBikpBwkIBSkLIARBGEkNACAEQfwBcUEcRw0oCyAFQTxqIAAQVgwICyAEQTBrQQpPDSYLIANBCDoAzAUMJAsgBEHwAXFBIEYNHwsgBEHwAXFBMEcNIwwDCyAEQTpHDSIMIAsCQCAEQRhJDQAgBEEZRg0AIARB/AFxQRxHDSILIAVBPGogABBWDAILIARB8AFxQSBGDRUgBEE6Rg0AIARB/AFxQTxHDSALIANBCzoAzAUMHwsgBS0APCIAQTJGDR8CQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAIABBAWsOMQIDBAUGBwgJCgsMDQ4PJRAmERITFBUWFxgZGhscHR4fACEiIyQlJicoKSorLC0wMTIBCyAFKAJAIQAMHwsgA0F+QX8gAygCaCADKAKcAUYbEJYBDD0LIAUvAT4hACAFIAMoAmg2AkwgBUEAOgB8IAUgA0HUAGooAgAiBDYCcCAFIAQgAygCWEECdGo2AnRBASAAIABBAU0bIQAgBSAFQcwAajYCeANAIABBAWsiAARAIAVB8ABqEF4NAQw2CwsgBUHwAGoQXiIARQ00IAAoAgAMNQsgA0EBIAUvAT4iACAAQQFNG0EBayIAIAMoApwBIgRBAWsgACAESRs2AmgMOwsgA0EBIAUvAT4iACAAQQFNGxA+DDoLIANBASAFLwE+IgAgAEEBTRsQbCADQQA2AmgMOQsgA0EBIAUvAT4iACAAQQFNGxBuIANBADYCaAw4CyADQQA2AmgMNwsCQCAFLQA9QQFrDgImABMLIANBADYCWAw2CyADQQEgBS8BPiIAIABBAU0bIgBBf3NBACAAayADKAJoIAMoApwBRhsQlgEMNQsgA0EBIAUvAT4iACAAQQFNGxBsDDQLIANBASAFLwE+IgAgAEEBTRsQlgEMMwsgA0EBIAUvAUAiACAAQQFNG0EBayIAIAMoApwBIgRBAWsgACAESRs2AmggA0EBIAUvAT4iACAAQQFNG0EBaxBhDDILIANBASAFLwE+IgAgAEEBTRsQbgwxCyADKAJoIgAgAygCnAEiBE8EQCADIARBAWsiADYCaAtBASAFLwE+IgQgBEEBTRsiBCADKAIYIABrIgYgBCAGSRshBCADIAMoAmxBmI/EABBvIgYoAgQgBigCCCAAQZSbxAAQogEoAgRFBEAgBigCBCAGKAIIIABBAWtBpJvEABCiASIHQqCAgIAQNwIAIAcgCCkBADcBCCAHQRBqIAhBCGovAQA7AQALIAVBIGogBigCBCAGKAIIIABBtJvEABCQASAFKAIgIAUoAiQgBBCZASAGKAIEIAYoAgggAEHEm8QAEKIBIgAoAgRFBEAgAEKggICAEDcCACAAIAgpAQA3AQggAEEQaiAIQQhqLwEAOwEACyAFQRhqIAYoAgQgBigCCCIAIAAgBGtB1JvEABCQASAFKAIYIQAgBSgCHCAFQfgAaiAIQQhqLwEAOwEAIAUgCCkBADcDcEEUbCEEA0AgBARAIABCoICAgBA3AgAgACAFKQNwNwIIIABBEGogBUH4AGovAQA7AQAgBEEUayEEIABBFGohAAwBCwsgBkEAOgAMIANB4ABqKAIAIANB5ABqKAIAIAMoAmwQowEMMAsgAygCnAEhBiADKAKgASEHQQAhBANAIAQgB0YNMEEAIQADQCAAIAZGBEAgA0HgAGooAgAgA0HkAGooAgAgBBCjASAEQQFqIQQMAgUgBUEAOwB4IAVBAjoAdCAFQQI6AHAgAyAAIARBxQAgBUHwAGoQFxogAEEBaiEADAELAAsACwALIAUoAkghBCAFKAJEIQAgBSAFKAJANgJ4IAUgADYCcCAFIARBAXQiBCAAaiIGNgJ8A0AgBARAAkACQAJAAkACQAJAAkACQAJAAkAgAC8BACIHQQFrDgcBMTExMQIDAAsgB0GXCGsOAwQFBgMLIANBADoAwQEMBwsgA0IANwJoIANBADoAvgEMBgsgA0EAOgC/AQwFCyADQQA6AHAMBAsgAxB9DAILIAMQmgEMAgsgAxB9IAMQmgELIAMQFQsgAEECaiEAIARBAmshBAwBCwsgBSAGNgJ0IAVB8ABqEMABDC4LIAUoAkghBCAFKAJEIQAgBSAFKAJANgJ4IAUgADYCcCAFIARBAXQiBCAAaiIHNgJ8A0AgBARAAkACQAJAAkACQAJAAkACQAJAIAAvAQAiBkEBaw4HAS8vLy8CAwALIAZBlwhrDgMGBAUDCyADQQE6AMEBDAYLIANBAToAvgEgA0EANgJoIAMgAygCqAE2AmwMBQsgA0EBOgC/AQwECyADQQE6AHAMAwsgAxBxDAILIAMQcQsjAEEwayIGJAAgAy0AvAFFBEAgA0EBOgC8ASADQfQAaiADQYgBahCCASADIANBJGoQgwEgBkEMaiIJIAMoApwBIAMoAqABIgxBAUEAIANBsgFqECEgA0EMahC0ASADIAlBJBAZIgkoAmAgCSgCZEEAIAwQYgsgBkEwaiQAIAMQFQsgAEECaiEAIARBAmshBAwBCwsgBSAHNgJ0IAVB8ABqEMABDC0LAkBBASAFLwE+IgAgAEEBTRtBAWsiACAFLwFAIgQgAygCoAEiBiAEG0EBayIESSAEIAZJcUUEQCADKAKoASEADAELIAMgBDYCrAEgAyAANgKoAQsgA0EANgJoIAMgAEEAIAMtAL4BGzYCbAwsCyADQQE6AHAgA0EAOwC9ASADQQA7AboBIANBAjoAtgEgA0ECOgCyASADQQA7AbABIANCADcCpAEgA0GAgIAINgKEASADQQI6AIABIANBAjoAfCADQgA3AnQgAyADKAKgAUEBazYCrAEMKwsgAygCoAEgAygCrAEiAEEBaiAAIAMoAmwiAEkbIQQgAyAAIARBASAFLwE+IgYgBkEBTRsgCBAfIANB4ABqKAIAIANB5ABqKAIAIAAgBBBiDCoLIAMgAygCaCADKAJsIgBBAEEBIAUvAT4iBCAEQQFNGyAIECYgA0HgAGooAgAgA0HkAGooAgAgABCjAQwpCwJAAkACQCAFLQA9QQFrDgMBAisACyADIAMoAmggAygCbCIAQQEgBSAIECYgA0HgAGooAgAgA0HkAGooAgAgACADKAKgARBiDCoLIAMgAygCaCADKAJsIgBBAiAFIAgQJiADQeAAaigCACADQeQAaigCAEEAIABBAWoQYgwpCyADQQAgAygCHCAIEDEgA0HgAGooAgAgA0HkAGooAgBBACADKAKgARBiDCgLIAMgAygCaCADKAJsIgAgBS0APUEEciAFIAgQJiADQeAAaigCACADQeQAaigCACAAEKMBDCcLIAMgBS0APToAsQEMJgsgAyAFLQA9OgCwAQwlCyADQQEQPgwkCyMAQRBrIgYkAAJAAkACQCADKAJoIglFDQAgCSADKAKcAU8NACAGQQhqIAMoAlQiACADKAJYIgQgCRBJIAYoAghBAUcNACAGKAIMIgcgBEsNASADQdAAaiIMKAIAIARGBH8gDEGspMQAEHcgAygCVAUgAAsgB0ECdGohACAEIAdLBEAgAEEEaiAAIAQgB2tBAnQQFgsgACAJNgIAIAMgBEEBajYCWAsgBkEQaiQADAELIAcgBEGspMQAEFoACwwjCyADKAJoIgAgAygCnAEiBkYEQCADIABBAWsiADYCaAsgAyAAIAMoAmwiBEEBIAUvAT4iByAHQQFNGyIHIAYgAGsiBiAGIAdLGyIGIAgQJCAAIAAgBmoiBiAAIAZLGyEGA0AgACAGRwRAIAMgACAEQSAgCBAXGiAAQQFqIQAMAQsLIANB4ABqKAIAIANB5ABqKAIAIAQQowEMIgsgAygCoAEgAygCrAEiAEEBaiAAIAMoAmwiAEkbIQQgAyAAIARBASAFLwE+IgYgBkEBTRsgCBBDIANB4ABqKAIAIANB5ABqKAIAIAAgBBBiDCELIAMQaiADLQDAAUEBRw0gIANBADYCaAwgCyADEGogA0EANgJoDB8LIAMgABAlDB4LIAMoAmgiBkUNHSAFLwE+IQAgAygCbCEEIAVBKGogAxB+IAUoAiwiByAETQ0SQQEgACAAQQFNGyEAIAUoAiggBEEEdGoiBEEEaigCACAEQQhqKAIAIAZBAWtBsKfEABCiASgCACEEA0AgAEUNHiADIAQQJSAAQQFrIQAMAAsACyADKAJsIgAgAygCqAFGDRIgAEUNHCADIABBAWsQYQwcCyAFQcwAaiIAIAMoApwBIgYgAygCoAEiBCADKAJIIAMoAkxBABAhIAVB8ABqIgcgBiAEQQFBAEEAECEgEhC0ASADIABBJBAZIQAgEBC0ASARIAdBJBAZGiAAQQA6ALwBIAVBlAFqIgcgBhBGIAAoAlAgAEHUAGooAgBBBEEEELIBIA5BCGogB0EIaiIGKAIANgIAIA4gBSkClAE3AgAgAEEAOwG6ASAAQQI6ALYBIABBAjoAsgEgAEEBOgBwIABCADcCaCAAQQA7AbABIABBgIAENgC9ASAAIARBAWs2AqwBIABCADcCpAEgAEGAgIAINgKYASAAQQI6AJQBIABBAjoAkAEgAEEANgKMASAAQoCAgAg3AoQBIABBAjoAgAEgAEECOgB8IABCADcCdCAHIAQQZCAAKAJcIABB4ABqKAIAQQFBARCyASANQQhqIAYoAgA2AgAgDSAFKQKUATcCAAwbCyAFKAJIIQQgBSgCRCEAIAUgBSgCQDYCeCAFIAA2AnAgBSAEQQF0IgQgAGoiBjYCfANAIAQEQAJAIAAvAQBBFEcEQCADQQA6AL0BDAELIANBADoAwAELIABBAmohACAEQQJrIQQMAQsLIAUgBjYCdCAFQfAAahDAAQwaCyADEJoBDBkLIAMQcQwYCyADQQEgBS8BPiIAIABBAU0bEJcBDBcLIAUoAkhBBWwhBCADLQC7ASEGIAUoAkAgBSgCRCIMIQADQAJAIARFDQAgACgAASEHAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkAgAC0AAEEBaw4SAQIDBAUGBwgJCgsMDQ4PEBETAAtBACEGIANBADsBugEgA0ECOgC2ASADQQI6ALIBDBELIANBAToAugEMEAsgA0ECOgC6AQwPCyADIAZBAXIiBjoAuwEMDgsgAyAGQQJyIgY6ALsBDA0LIAMgBkEIciIGOgC7AQwMCyADIAZBEHIiBjoAuwEMCwsgAyAGQQRyIgY6ALsBDAoLIANBADoAugEMCQsgAyAGQf4BcSIGOgC7AQwICyADIAZB/QFxIgY6ALsBDAcLIAMgBkH3AXEiBjoAuwEMBgsgAyAGQe8BcSIGOgC7AQwFCyADIAZB+wFxIgY6ALsBDAQLIAggBzYBAAwDCyAIQQI6AAAMAgsgAyAHNgG2AQwBCyADQQI6ALYBCyAAQQVqIQAgBEEFayEEDAELCyAMQQFBBRCyAQwWCyADQQA2AqQBDBULIAUoAkghBCAFKAJEIQAgBSAFKAJANgJ4IAUgADYCcCAFIARBAXQiBCAAaiIGNgJ8A0AgBARAAkAgAC8BAEEURwRAIANBAToAvQEMAQsgA0EBOgDAAQsgAEECaiEAIARBAmshBAwBCwsgBSAGNgJ0IAVB8ABqEMABDBQLIANBATYCpAEMEwsgA0EBIAUvAT4iACAAQQFNGxCYAQwSCyAFLQA9DQELIwBBEGsiACQAIABBCGogAygCVCIHIAMoAlgiBCADKAJoEEkCQAJAIAAoAghFBEAgACgCDCIGIARPDQEgByAGQQJ0aiIHIAdBBGogBCAGQX9zakECdBAWIAMgBEEBazYCWAsgAEEQaiQADAELIwBBMGsiACQAIAAgBDYCBCAAIAY2AgAgAEEDNgIMIABBrIfEADYCCCAAQgI3AhQgACAAQQRqrUKAgICAsAGENwMoIAAgAK1CgICAgLABhDcDICAAIABBIGo2AhAgAEEIakG8pMQAEJsBAAsMEAsgA0EANgJYDA8LIANBASAFLwE+IgAgAEEBTRtBAWsQYQwOCyADQQEgBS8BPiIAIABBAU0bEGwMDQsgAy0AwgFBAUcNDCADIAUvAT4iACADKAKcASAAGyAFLwFAIgAgAygCoAEgABsQLAwMCyADIAA2AsQBIANBCToAzAUMCgsgBCAHQbCnxAAQWQALIANBARCXAQwJCwALQQALIgAgAygCnAEiBEEBayAAIARJGzYCaAwGCyAKIAA2AgAMBAsgAyAANgLEASADQQU6AMwFDAMLIANBADoAzAUMAgsgA0EGOgDMBQwBCyAKKAKEBCEEAkACQAJAAkACQCAAQTprDgIBAAILIApBHyAEQQFqIgAgAEEgRhs2AoQEDAMLIARBIEkNASAEQSBB0J3EABBZAAsgBEEgTwRAIARBIEHgncQAEFkACyAKIARBBHRqQQRqIgYoAgAiBEEGSQRAIAYgBEEBdGpBBGoiBCAELwEAQQpsIABBMGtB/wFxajsBAAwCCyAEQQZBoKPEABBZAAsgCiAEQQR0akEEaiIEKAIAQQFqIQAgBEEFIAAgAEEFTxs2AgALCyAFQTI6ADwMAAsAC9IYAh1/AX4jAEGAA2siAiQAIAJB+ABqIAAQiwEgAigCfCEXIAIoAnghACACQQA2AowBIAJCgICAgMAANwKEASACQQA2ApgBIAJCgICAgMAANwKQASACQfAAaiAAEH4gAigCdCIAIAFLBEAgAigCcCABQQR0aiIBKAIEIQAgACABKAIIQRRsaiEbIAJBwAJqIRUgAkHkAmohGCACQYACaiIBQRhqIRIgAkH0AWohGSACQZwCaiEcIAFBDGohHSACQY8CaiEeQYCAgIB4IQpBAyELA0AgCiEIIAQhASAGIQcCQAJAAkACQAJAAkACQAJAA0AgGyAAIglGDQEgAEEUaiEAIAkoAgQiDEUNAAsgCUEIaiIRIAktABFBEHEiBkECdkEEc2ooAAAhBCAeQQJBAyAGGyAEIARB/wFxQQJGGyIEQRh2OgAAIAIgDzYCiAIgAiALrUL/AYMgE61C////B4NCCIYgFK1CIIaEhCIfNwOAAiACIAQ6AIwCIAIgBEEIdiIGOwCNAiALQf8BcSIKQQNHDQFBAyELIARB/wFxQQNHDQIMBwsgC0H/AXFBA0cEQCACIA82AvgCIAIgC61C/wGDIBOtQv///weDQgiGIBStQiCGhIQ3A/ACIAJBhAFqIAJB8AJqQYiDxAAQcAsgCEGAgICAeEcEQCACQaACaiACQagBai8BADsBACACIBA2ApQCIAIgAzYCkAIgAiAONgKMAiACIAc2AogCIAIgATYChAIgAiAINgKAAiACIAIpA6ABNwKYAiACIAIvAZ4BOwGiAiACQZABaiACQYACakGYg8QAEIcBCyACKAKYASEKIAIoApQBIQYgAigCkAEgAigCiAEhByACKAKEASACKAKMAUEAIQsgAkEANgL8AkEMbCEFEAchDBABIQQgByEBA0AgBQRAIAJB/AJqIgMQByIAQeCCxAAgASgCBBCsASADIABB4YLEACABKAIIEKwBIAJB2ABqIAEQIyACKAJcIQMgAigCWA0HIABB4oLEAEEBECIgAxAIIAQgCyAAEAIgBUEMayEFIAtBAWohCyABQQxqIQEMAQsLIAxBk4LEAEECECIgBBAIIApBJGwhCxABIQQgAkHTAWohD0EAIQMgBiEBA0AgCwRAIAJB/AJqIgUQByIAQeCCxAAgASgCDBCsASAFIABB4YLEACABKAIQEKwBIAEtACEhBSABKAAcIQggASgAGCEJAn8gAi0A/QJFBEAQCSETQQAMAQsQByETQQELIQ4gAkEANgKwAiACIBM2AqwCIAIgDjYCqAIgAiACQfwCajYCuAICQCAJQf8BcUECRg0AIAIgCUEIdiIOOwDRASAPIA5BEHY6AAAgAiAJOgDQASACQdAAaiACQagCakGRgsQAIAJB0AFqEDggAigCUEUNACACKAJUIQMMBwsCQCAIQf8BcUECRg0AIAIgCEEIdiIJOwDRASAPIAlBEHY6AAAgAiAIOgDQASACQcgAaiACQagCakGTgsQAIAJB0AFqEDggAigCSEUNACACKAJMIQMMBwsCQAJAAkAgAS0AIEEBaw4CAAECCyACQThqIAJBqAJqQZqCxABBBBBEIAIoAjhFDQEgAigCPCEDDAgLIAJBQGsgAkGoAmpBlYLEAEEFEEQgAigCQEUNACACKAJEIQMMBwsCQCAFQQFxRQ0AIAJBMGogAkGoAmpBnoLEAEEGEEQgAigCMEUNACACKAI0IQMMBwsCQCAFQQJxRQ0AIAJBKGogAkGoAmpBpILEAEEJEEQgAigCKEUNACACKAIsIQMMBwsCQCAFQQRxRQ0AIAJBIGogAkGoAmpBrYLEAEENEEQgAigCIEUNACACKAIkIQMMBwsCQCAFQQhxRQ0AIAJBGGogAkGoAmpBuoLEAEEFEEQgAigCGEUNACACKAIcIQMMBwsCQCAFQRBxRQ0AIAJBEGogAkGoAmpBv4LEAEEHEEQgAigCEEUNACACKAIUIQMMBwsgAigCrAIhBSACKAKwAgRAIAIoArQCEL8BCyAAQeOCxABBARAiIAUQCCACQQhqIAEoAgQgASgCCBC3ASACKAIMIQUgAEHkgsQAQQEQIiAFEAggAkH8AmogAEHlgsQAIAEoAhQQrAEgBCADIAAQAiALQSRrIQsgA0EBaiEDIAFBJGohAQwBCwsgDEGRgsQAQQIQIiAEEAggB0EEQQwQsgEgBiEBA0AgCgRAIAEoAgAgAUEEaigCAEEBQQEQsgEgCkEBayEKIAFBJGohAQwBCwsgBkEEQSQQsgEgFyAXKAIAQQFrNgIAIAJBgANqJAAgDA8LIARB/wFxIg1BA0YNAiAKQQJGIgogDUECRiINc0UEQCAKDQIgDQ0CIAJBgAJqIB0QaQ0CCyACIA82AsgBIAIgHzcDwAEgAkGEAWogAkHAAWpByIPEABBwCyAFIRQgBiETIAQhCyAMIQ8MBAsgDCAPaiEPDAMLIAIgDzYCuAEgAiAfNwOwASACQYQBaiACQbABakG4g8QAEHBBAyELDAILIAIoAqwCEL8BIAIoArACIAIoArQCEMQBCyAAEL8BIAQQvwEgDBC/ASACIAM2AqgCQaiAwABBKyACQagCakGYgMAAQaiDxAAQUAALIBEpAAAhHyACQbACaiIWIBFBCGovAAA7AQAgAiAfNwOoAiAJKAIAIQQgAkEANgLwAiACQegAaiAEIAJB8AJqEDMgAkGAAmogAigCaCACKAJsEGAgAkHYAWoiGiAWLwEAOwEAIAIgAikDqAI3A9ABIAIoAogCIQYgAigChAIhBCACKAKAAiEKAkACQCAJKAIAIg1BgAFJDQACQCAJKAIEQQFLDQAgDUH//wNNBEAgDUGHgsAAai0AAA0BDAILIA1BgYA8a0HwNU8NAQsgCEGAgICAeEcEQCAZIAIpAqABNwIAIBlBCGogAkGoAWovAQA7AQAgAiAQNgLwASACIAM2AuwBIAIgDjYC6AEgAiAHNgLkASACIAE2AuABIAIgCDYC3AEgAiACLwGeATsB/gEgAkGQAWogAkHcAWpB6IPEABCHAQsgEiACKQPQATcCACASQQhqIBovAQA7AQAgAiAMNgKUAiACIAw2ApACIAIgBTYCjAIgAiAGNgKIAiACIAQ2AoQCIAIgCjYCgAIgAkGQAWogAkGAAmpB+IPEABCHAUGAgICAeCEKIAchBiABIQQMAQsgEiACKQKgATcCACASQQhqIAJBqAFqIg0vAQA7AQAgAiAQNgKUAiACIAM2ApACIAIgDjYCjAIgAiAHNgKIAiACIAE2AoQCIAIgETYCpAIgAiACLwGeATsBogIgAiAINgKAAgJAIAhBgICAgHhGDQACQAJAIBIgERCKAUUNACAcIAlBDGoQigFFDQAgAi0AoAIgCS0AEEcNACACLQChAiAJLQARRg0BCyAYIAIpA6ABNwIAIBhBCGogDS8BADsBACACIBA2AuACIAIgAzYC3AIgAiAONgLYAiACIAc2AtQCIAIgATYC0AIgAiAINgLMAiACIAIvAZ4BOwHuAiACQZABaiACQcwCakHYg8QAEIcBDAELIBUgAikDoAE3AgAgFUEIaiIRIA0vAQA7AQAgAiAQNgK8AiACIAM2ArgCIAIgDjYCtAIgAiAHNgKwAiACIAE2AqwCIAIgCDYCqAIgAiACLwGeATsBygIgAgJ/IAkoAgAiBkGAAU8EQCACQQA2AvACIAJB4ABqIAYgAkHwAmoQMyACKAJgIQMgAigCZCIGIAggB2tLBEAgAkGoAmogByAGQQFBARB5IAIoArACIQcgAigCrAIhAQsgASAHaiADIAYQGRogBiAHagwBCyAHIAhGBEAgAkGoAmpBxIHAABA3IAIoAqwCIQELIAEgB2ogBjoAACAHQQFqCyIGNgKwAiACIAIoArgCIAxqIgM2ArgCIAJB+AJqIgggES8BADsBACACIAIvAcoCOwH8AiACIBUpAgA3A/ACIAIoAqgCIAIoAqwCIAIoArQCIQ4gAigCvAIhECANIAgvAQA7AQAgAiACKQPwAjcDoAEgAiACLwH8AjsBngEgCiAEQQFBARCyASEEIQoMAQsgFiAaLwEAOwEAIAIgAikD0AE3A6gCIA0gFi8BADsBACACIAIpA6gCNwOgASACIAIvAfACOwGeASAFIQ4gDCIDIRALIAUgDGohBQwACwALIAEgAEGQp8QAEFkAC98UAQZ/IwBBwAJrIgIkACABKAIEIQMDQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAIAMEQCACQbgCaiABKAIAEHUgAigCuAIhAyACKAK8AkEBaw4GAQUEBQIDBQsgAEESOgAADAsLAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAIAMvAQAiAw4eAAECAwQFDgYOBw4ODg4ODg4ODg4OCAgJCgsODA4NDgsgAkGoAWpBASABKAIAIAEoAgRBwJ7EABCSASABIAIpA6gBNwIAIABBADoAAAwYCyACQbABakEBIAEoAgAgASgCBEHQnsQAEJIBIAEgAikDsAE3AgAgAEEBOgAADBcLIAJBuAFqQQEgASgCACABKAIEQeCexAAQkgEgASACKQO4ATcCACAAQQI6AAAMFgsgAkHAAWpBASABKAIAIAEoAgRB8J7EABCSASABIAIpA8ABNwIAIABBAzoAAAwVCyACQcgBakEBIAEoAgAgASgCBEGAn8QAEJIBIAEgAikDyAE3AgAgAEEEOgAADBQLIAJB0AFqQQEgASgCACABKAIEQZCfxAAQkgEgASACKQPQATcCACAAQQU6AAAMEwsgAkHYAWpBASABKAIAIAEoAgRBoJ/EABCSASABIAIpA9gBNwIAIABBBjoAAAwSCyACQeABakEBIAEoAgAgASgCBEGwn8QAEJIBIAEgAikD4AE3AgAgAEEHOgAADBELIAJB6AFqQQEgASgCACABKAIEQcCfxAAQkgEgASACKQPoATcCACAAQQg6AAAMEAsgAkHwAWpBASABKAIAIAEoAgRB0J/EABCSASABIAIpA/ABNwIAIABBCToAAAwPCyACQfgBakEBIAEoAgAgASgCBEHgn8QAEJIBIAEgAikD+AE3AgAgAEEKOgAADA4LIAJBgAJqQQEgASgCACABKAIEQfCfxAAQkgEgASACKQOAAjcCACAAQQs6AAAMDQsgAkGIAmpBASABKAIAIAEoAgRBgKDEABCSASABIAIpA4gCNwIAIABBDDoAAAwMCyACQZACakEBIAEoAgAgASgCBEGQoMQAEJIBIAEgAikDkAI3AgAgAEENOgAADAsLAkACQCADQR5rQf//A3FBCE8EQCADQSZrDgIBCAILIAJBCGpBASABKAIAIAEoAgRBsKLEABCSASABIAIpAwg3AgAgACADQR5rOgACIABBDjsAAAwMCwJAIAEoAgQiA0ECTwRAIAJBmAFqIAEoAgBBEGoQdSACKAKYASIDDQEgASgCBCEDCyACQegAakEBIAEoAgAgA0GgoMQAEJIBIAIoAmwhAyACKAJoIQQMDQsCQAJAAkAgAigCnAFBAUcNACADLwEAQQJrDgQBAAACAAsgAkHwAGpBASABKAIAIAEoAgRB8KDEABCSASACKAJ0IQMgAigCcCEEDA4LIAEoAgAhAyABKAIEIgRBBU8EQCADLQAkIQUgAy8BNCEGIAMvAUQhByACQYABakEFIAMgBEGwoMQAEJIBIAEgAikDgAE3AgAgAEEOOgAAIAAgBSAGQQh0QYD+A3EgB0EQdHJyQQh0QQFyNgABDA0LIAJB+ABqQQIgAyAEQcCgxAAQkgEgAigCfCEDIAIoAnghBAwNCyABKAIAIQMgASgCBCIEQQNPBEAgAy0AJCEFIAJBkAFqQQMgAyAEQdCgxAAQkgEgASACKQOQATcCACAAIAU6AAIgAEEOOwAADAwLIAJBiAFqQQIgAyAEQeCgxAAQkgEgAigCjAEhAyACKAKIASEEDAwLAkACQCADQfj/A3FBKEcEQCADQTBrDgIBCQILIAJBEGpBASABKAIAIAEoAgRBoKLEABCSASABIAIpAxA3AgAgACADQShrOgACIABBEDsAAAwMCwJAIAEoAgQiA0ECTwRAIAJB2ABqIAEoAgBBEGoQdSACKAJYIgMNASABKAIEIQMLIAJBKGpBASABKAIAIANBkKHEABCSASACKAIsIQMgAigCKCEEDA0LAkACQAJAIAIoAlxBAUcNACADLwEAQQJrDgQBAAACAAsgAkEwakEBIAEoAgAgASgCBEHgocQAEJIBIAIoAjQhAyACKAIwIQQMDgsgASgCACEDIAEoAgQiBEEFTwRAIAMtACQhBSADLwE0IQYgAy8BRCEHIAJBQGtBBSADIARBoKHEABCSASABIAIpA0A3AgAgAEEQOgAAIAAgBSAGQQh0QYD+A3EgB0EQdHJyQQh0QQFyNgABDA0LIAJBOGpBAiADIARBsKHEABCSASACKAI8IQMgAigCOCEEDA0LIAEoAgAhAyABKAIEIgRBA08EQCADLQAkIQUgAkHQAGpBAyADIARBwKHEABCSASABIAIpA1A3AgAgACAFOgACIABBEDsAAAwMCyACQcgAakECIAMgBEHQocQAEJIBIAIoAkwhAyACKAJIIQQMDAsgA0HaAGtB//8DcUEISQ0HIANB5ABrQf//A3FBCE8NAyACQSBqQQEgASgCACABKAIEQYCixAAQkgEgASACKQMgNwIAIAAgA0HcAGs6AAIgAEEQOwAADAoLIAMvAQAiBEEwRwRAIARBJkcNAyADLwECQQJHDQNBCCEEQQYhBUEEIQYMCQsgAy8BAkECRw0CQQghBEEGIQVBBCEGDAcLIAMvAQAiBEEwRwRAIARBJkcNAiADLwECQQJHDQJBCiEEQQghBUEGIQYMCAsgAy8BAkECRw0BQQohBEEIIQVBBiEGDAYLIAMvAQAiBEEwRwRAIARBJkcNASADLwECQQVHDQEgAy0ABCEDIAJBqAJqQQEgASgCACABKAIEQeCixAAQkgEgASACKQOoAjcCACAAIAM6AAIgAEEOOwAADAgLIAMvAQJBBUYNAQsgAkEBIAEoAgAgASgCBEGAo8QAEJIBIAIoAgQhAyACKAIAIQQMBwsgAy0ABCEDIAJBsAJqQQEgASgCACABKAIEQfCixAAQkgEgASACKQOwAjcCACAAIAM6AAIgAEEQOwAADAULIAJBoAFqQQEgASgCACABKAIEQYChxAAQkgEgASACKQOgATcCACAAQQ86AAAMBAsgAkHgAGpBASABKAIAIAEoAgRB8KHEABCSASABIAIpA2A3AgAgAEEROgAADAMLIAJBGGpBASABKAIAIAEoAgRBkKLEABCSASABIAIpAxg3AgAgACADQdIAazoAAiAAQQ47AAAMAgsgAyAGai0AACEGIAMgBWovAQAhBSADIARqLwEAIQMgAkGgAmpBASABKAIAIAEoAgRB0KLEABCSASABIAIpA6ACNwIAIABBEDoAACAAIAYgBUEIdEGA/gNxIANBEHRyckEIdEEBcjYAAQwBCyACQZgCakEBIAEoAgAgASgCBEHAosQAEJIBIAEgAikDmAI3AgAgAyAGai0AACEBIAMgBWovAQAhBSADIARqLwEAIQMgAEEOOgAAIAAgASAFQQh0QYD+A3EgA0EQdHJyQQh0QQFyNgABCyACQcACaiQADwsgASAENgIAIAEgAzYCBAwACwALvg4BA38jAEHgAGsiAyQAIAFBBGohBAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkAgASgCACIFQYCAxABGBEAgAkFAag42AQIDBAUGBwgJCgsMDQ43Nw83NxARNzcSEzcUNzc3NzcVFhc3GBkaGxw3NzcdHjc3NzcfIDIhNwsCQCACQewAaw4FNTc3NzMACyACQegARg0zDDYLIABBHToAACAAIAEvAQg7AQIMNgsgAEEMOgAAIAAgAS8BCDsBAgw1CyAAQQk6AAAgACABLwEIOwECDDQLIABBCjoAACAAIAEvAQg7AQIMMwsgAEEIOgAAIAAgAS8BCDsBAgwyCyAAQQQ6AAAgACABLwEIOwECDDELIABBBToAACAAIAEvAQg7AQIMMAsgAEECOgAAIAAgAS8BCDsBAgwvCyAAQQs6AAAgACABLwEYOwEEIAAgAS8BCDsBAgwuCyAAQQM6AAAgACABLwEIOwECDC0LIAEvAQgOBBcYGRoWCyABLwEIDgMbHB0aCyAAQR46AAAgACABLwEIOwECDCoLIABBFToAACAAIAEvAQg7AQIMKQsgAEENOgAAIAAgAS8BCDsBAgwoCyAAQS06AAAgACABLwEIOwECDCcLIABBKDoAACAAIAEvAQg7AQIMJgsgAS8BCA4GGRgaGBgbGAsgAEEWOgAAIAAgAS8BCDsBAgwkCyAAQQE6AAAgACABLwEIOwECDCMLIABBAjoAACAAIAEvAQg7AQIMIgsgAEEKOgAAIAAgAS8BCDsBAgwhCyAAQSI6AAAgACABLwEIOwECDCALIABBLzoAACAAIAEvAQg7AQIMHwsgAEEwOgAAIAAgAS8BCDsBAgweCyAAQQs6AAAgACABLwEYOwEEIAAgAS8BCDsBAgwdCyABLwEIDgQUExMVEwsgAyAEIAEoAoQEQfCdxAAQhAEgA0FAayIBIAMoAgAiAiACIAMoAgRBBHRqEC8gA0E7aiABQQhqKAIANgAAIAMgAykCQDcAMyAAQSs6AAAgACADKQAwNwABIABBCGogA0E3aikAADcAAAwbCyADQQhqIAQgASgChARBgJ7EABCEASADQUBrIgEgAygCCCICIAIgAygCDEEEdGoQLyADQTtqIAFBCGooAgA2AAAgAyADKQJANwAzIABBJToAACAAIAMpADA3AAEgAEEIaiADQTdqKQAANwAADBoLIANBGGogBCABKAKEBEGQnsQAEIQBIAMgAykDGDcCTCADQdYAaiADQcwAahARAn8gAy0AVkESRgRAQQAhAUEAIQRBAQwBCyADQRBqQQRBAUEFQfyJxAAQbSADQdoAai0AACEBIAMoAhAhAiADKAIUIgQgAygAVjYAACAEQQRqIAE6AAAgA0EBNgI4IAMgBDYCNCADIAI2AjAgAyADKQJMNwJAQQUhAkEBIQEDQCADQdsAaiADQUBrEBEgAy0AW0ESRkUEQCADKAIwIAFGBEAgA0EwaiABQQFBAUEFEHkgAygCNCEECyACIARqIgUgAygAWzYAACAFQQRqIANB3wBqLQAAOgAAIAMgAUEBaiIBNgI4IAJBBWohAgwBCwsgAygCMCEEIAMoAjQLIQIgACABNgIMIAAgAjYCCCAAIAQ2AgQgAEEpOgAADBkLIABBEzoAACAAIAEvARg7AQQgACABLwEIOwECDBgLIABBJzoAAAwXCyAAQSY6AAAMFgsgAEEyOgAADBULIABBFzsBAAwUCyAAQZcCOwEADBMLIABBlwQ7AQAMEgsgAEGXBjsBAAwRCyAAQTI6AAAMEAsgAEEYOwEADA8LIABBmAI7AQAMDgsgAEGYBDsBAAwNCyAAQTI6AAAMDAsgAEEHOwEADAsLIABBhwI7AQAMCgsgAEGHBDsBAAwJCyAAQTI6AAAMCAsgAEEuOwEADAcLIABBrgI7AQAMBgsgAS8BCEEIRg0DIABBMjoAAAwFCyAFQSFHDQMgAEEUOgAADAQLIAVBP0cNAiADQSBqIAQgASgChARBoJ7EABCEASADQUBrIgEgAygCICICIAIgAygCJEEEdGoQMCADQTtqIAFBCGooAgA2AAAgAyADKQJANwAzIABBEjoAACAAIAMpADA3AAEgAEEIaiADQTdqKQAANwAADAMLIAVBP0cNASADQShqIAQgASgChARBsJ7EABCEASADQUBrIgEgAygCKCICIAIgAygCLEEEdGoQMCADQTtqIAFBCGooAgA2AAAgAyADKQJANwAzIABBEDoAACAAIAMpADA3AAEgAEEIaiADQTdqKQAANwAADAILIABBMToAACAAIAEvARg7AQQgACABLwEoOwECDAELIABBMjoAAAsgA0HgAGokAAuZCgEKfwJAAkACQCAAKAIAIgUgACgCCCIDcgRAAkAgA0EBcUUNACABIAJqIQYCQCAAKAIMIglFBEAgASEEDAELIAEhBANAIAQgBkYNAgJ/IAQiAywAACIEQQBOBEAgA0EBagwBCyADQQJqIARBYEkNABogA0EDaiAEQXBJDQAaIANBBGoLIgQgA2sgB2ohByAJIAhBAWoiCEcNAAsLIAQgBkYNAAJAIAQsAABBAE4NAAsgByACAn8CQCAHRQ0AIAIgB00EQCACIAdGDQFBAAwCCyABIAdqLAAAQUBODQBBAAwBCyABCyIDGyECIAMgASADGyEBCyAFRQ0DIAAoAgQhCyACQRBPBEAgASABQQNqQXxxIgdrIgggAmoiCkEDcSEJQQAhBUEAIQMgASAHRwRAIAhBfE0EQEEAIQYDQCADIAEgBmoiBCwAAEG/f0pqIARBAWosAABBv39KaiAEQQJqLAAAQb9/SmogBEEDaiwAAEG/f0pqIQMgBkEEaiIGDQALCyABIQQDQCADIAQsAABBv39KaiEDIARBAWohBCAIQQFqIggNAAsLAkAgCUUNACAHIApBfHFqIgQsAABBv39KIQUgCUEBRg0AIAUgBCwAAUG/f0pqIQUgCUECRg0AIAUgBCwAAkG/f0pqIQULIApBAnYhBiADIAVqIQUDQCAHIQggBkUNBEHAASAGIAZBwAFPGyIJQQNxIQogCUECdCEH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IgMvAAA7AAAgAigCBCACKAIIIAFBAWoiBUGcmMQAEKIBKAIEQQJGBEAgAigCBCACKAIIIAFBAmpBrJjEABCiASIBQqCAgIAQNwIAIAEgBCkAADcACCABQRBqIAMvAAA7AAALIAIoAgQgAigCCCAFQbyYxAAQogEiAkEgNgIADAYLQQEhBiABQQFqIQggAigCBCEJIAcNBEECIQAgCSAFIAFB7JjEABCiASIBQQI2AgQgASADNgIAIAEgBCkAADcACCABQRBqIARBCGovAAA7AAAgAigCBCACKAIIIAhB/JjEABCiASICQSA2AgAMBQsgBw0CAkACQCAADgIKAAELQQEhBiACKAIEIAUgAUEBakGsmcQAEKIBIgJBIDYCAEEAIQAMCAsgAigCBCAFIAFBAWtBvJnEABCiASIAQqCAgIAQNwIAIAAgBCkAADcACCAAQRBqIARBCGoiBy8AADsAAEECIQAgAigCBCACKAIIIAFBzJnEABCiASIFQQI2AgQgBSADNgIAIAUgBCkAADcACCAFQRBqIAcvAAA7AAAgAigCBCACKAIIIAFBAWoiA0HcmcQAEKIBKAIEQQJGBEAgAigCBCACKAIIIAFBAmpB7JnEABCiASIBQqCAgIAQNwIAIAEgBCkAADcACCABQRBqIAcvAAA7AAALIAIoAgQgAigCCCADQfyZxAAQogEiAkEgNgIADAQLIABBFUHciMQAEFkACyAAQbQBQeyIxAAQWQALIAIoAgQgBSABQQFrQYyZxAAQogEiAEKggICAEDcCACAAIAQpAAA3AAggAEEQaiAEQQhqLwAAOwAAIAIoAgQgAigCCCABQZyZxAAQogEMAwsgCSAFIAFBzJjEABCiASIAQQE2AgQgACADNgIAIAAgBCkAADcACCAAQRBqIARBCGovAAA7AAAgAigCBCACKAIIIAhB3JjEABCiASICQSA2AgBBASEADAMLQQAhBgwCCyAGIAUgAUHMl8QAEKIBCyICIAM2AgBBASEGQQEhAAsgAiAGNgIEIAIgBCkAADcACCACQRBqIARBCGovAAA7AAALIAALyQUCCn8BfiMAQZABayIEJAACQAJAAkADQEEAIAJBBHRrIQUCQANAIAJFDQUgAEUNBSAAIAJqQRhJDQMgACACIAAgAkkiAxtBCUkNASADRQRAIAEhAwNAIAMgBWoiASAD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SyAEIQANAAsLAkAgBEHjAE0EQCAEIQAMAQsgAkECayICIANBBmpqIARB//8DcUHkAG4iAEGcf2wgBGpB//8DcUEBdEGPqcQAai8AADsAAAsCQCAAQQpPBEAgAkECayICIANBBmpqIABBAXRBj6nEAGovAAA7AAAMAQsgAkEBayICIANBBmpqIABBMHI6AAALIAFBAUEAIANBBmogAmpBCiACaxAbIANBEGokAAvNAgIFfwJ+IwBBIGsiAiQAIAACfwJAAkAgAS0AIEUEQAwBCyABQQA6ACACQCABKAIAQQFGBEAgASgCFCIFIAEoAhxrIgMgASgCCEsNAQsMAQsgBSADIAEoAgRrIgRPBEBBACEDIAFBADYCFCACIAFBDGo2AhQgAiABKAIQIgY2AgwgAiAENgIYIAIgBSAEazYCHCACIAYgBEEEdGo2AhAgAS0AvAENAkEUQQQQjQEhASACQQxqIgNBCGopAgAhByACKQIMIQggAUEQaiADQRBqKAIANgIAIAFBCGogBzcCACABIAg3AgBBlKbEAAwDCyAEIAVB3I3EABDJAQALIAJBADYCDEEBIQMgAS0AvAENAEEAQQEQjQEhAUH4pcQADAELQQBBARCNASEBIANFBEAgAkEMahBmC0H4pcQACzYCBCAAIAE2AgAgAkEgaiQAC+YCAQJ/IwBB4AVrIgMkACADQcwBakEAQYUEECAaIANBgIDEADYCyAEgA0EEaiIEIAAgAUEBIAJBABAhIANBKGogACABQQFBAEEAECEgA0HUBWogARBkIANB1ABqIAAQRiADQQA6AMABIAMgATYCpAEgAyAANgKgASADQQA7Ab4BIANBAjoAugEgA0ECOgC2ASADQQE6AHQgA0IANwJsIAMgAjYCUCADQQE2AkwgA0EAOwG0ASADQQA6AMUBIANBgIAENgDBASADQgA3AqgBIAMgAUEBazYCsAEgA0ECOgCAASADQQI6AIQBIANBADYCkAEgA0ECOgCUASADQQI6AJgBIANBgICACDYCnAEgA0IANwJ4IANCgICACDcCiAEgA0HoAGogA0HcBWooAgA2AgAgA0EAOgDGASADIAMpAtQFNwJgQdQFEKsBIgBBADYCACAAQQRqIARB0AUQGRogA0HgBWokACAAC5MCAQV/AkACQAJAQX8gACgCnAEiAyABRyABIANJG0H/AXEOAgIBAAsgACAAKAJYIgMEfyAAKAJUIQUDQCADQQJJRQRAIANBAXYiBiAEaiIHIAQgBSAHQQJ0aigCACABSRshBCADIAZrIQMMAQsLIAQgBSAEQQJ0aigCACABSWoFQQALNgJYDAELQQAgASADQXhxQQhqIgRrIgNBACABIANPGyIDQQN2IANBB3FBAEdqayEDIABB0ABqIQUDQCADRQ0BIAUgBEHMpMQAEIwBIANBAWohAyAEQQhqIQQMAAsACyACIAAoAqABRwRAIABBADYCqAEgACACQQFrNgKsAQsgACACNgKgASAAIAE2ApwBIAAQFQvzAQIEfwF+IwBBEGsiBiQAAkAgAiACIANqIgNLBEBBACECDAELQQAhAiAEIAVqQQFrQQAgBGtxrUEIQQQgBUEBRhsiByABKAIAIghBAXQiCSADIAMgCUkbIgMgAyAHSRsiB61+IgpCIIinDQAgCqciA0GAgICAeCAEa0sNACAEIQICfyAIBEAgBUUEQCAGQQhqIAQgAxCeASAGKAIIDAILIAEoAgQgBSAIbCAEIAMQjwEMAQsgBiAEIAMQngEgBigCAAsiBUUNACABIAc2AgAgASAFNgIEQYGAgIB4IQILIAAgAzYCBCAAIAI2AgAgBkEQaiQAC5kCAQN/AkACQAJAIAEgAkYNACAAIAEgAkGMl8QAEKIBKAIERQRAIAAgASACQQFrQZyXxAAQogEiBUKggICAEDcCACAFIAQpAAA3AAggBUEQaiAEQQhqLwAAOwAACyACIANLDQEgASADSQ0CIANBFGwiBiACQRRsIgJrIQUgACACaiECIARBCGohBwNAIAUEQCACQqCAgIAQNwIAIAIgBCkAADcACCACQRBqIAcvAAA7AAAgBUEUayEFIAJBFGohAgwBCwsgASADTQ0AIAAgBmoiACgCBA0AIABCoICAgBA3AgAgACAEKQAANwAIIABBEGogBEEIai8AADsAAAsPCyACIANBrJfEABDLAQALIAMgAUGsl8QAEMkBAAuLAgEDfyMAQTBrIgMkACADIAI2AhggAyABNgIUAkAgA0EUahBnIgFB//8DcUEDRgRAIABBADYCCCAAQoCAgIAgNwIADAELIANBCGpBBEECQQJB/InEABBtIAMoAgghAiADKAIMIgQgATsBACADQQE2AiQgAyAENgIgIAMgAjYC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QRBrKAIAQQFHDQAgAUEMay0AAEECRw0AIAFBCGstAABBAkcNACABQQRrLQAADQAgAUEDay0AAEEfcQ0AIAJBFGohAiAAQQFqIQAgBCEBDAELCyAAIQMLIAMLsQEBAn8jAEEQayICJAACQCABRQ0AIAFBA2pBAnYhAQJAIABBBE0EQCABQQFrIgNBgAJJDQELIAJBpPPEACgCADYCCCABIAAgAkEIakGi68QAQQRBBRBdIQBBpPPEACACKAIINgIADAELIAJBpPPEADYCBCACIANBAnRBpOvEAGoiAygCADYCDCABIAAgAkEMaiACQQRqQQZBBxBdIQAgAyACKAIMNgIACyACQRBqJAAgAAuqAQECfyMAQTBrIgMkACADQRBqIAAQiAEgAygCFCADKAIQIgAgASACECwgA0EYaiAAQeAAaigCACAAQeQAaigCABAnIANBCGogABAqIAMgAykDCDcCJCADIAMoAhwgAygCIBBoIAMoAgQhACADKAIAQQFxBEAgAyAANgIsQaiAwABBKyADQSxqQZiAwABB+ILEABBQAAsgA0EYahB7QQA2AgAgA0EwaiQAIAALoAEBA38jAEEQayIFJAAgBUEIaiAAIAEgAkHIkMQAEHMgBSgCDCIGIAMgAiABayIHIAMgB0kbIgNPBEAgBiADayIGIAUoAgggBkEEdGogAxAYIAAgASABIANqIAQQMSABBEAgACABQQFrQdiQxAAQb0EAOgAMCyAAIAJBAWtB6JDEABBvQQA6AAwgBUEQaiQADwtBtIvEAEEhQdiLxAAQfwALqwEBAn8jAEEQayIEJAAgASACIAMQfCABKAIIQQAhAiABQQA2AgggASgCDCEDELUBAkAgASgCAEUEQCABKAIEIANBggEQChC/AUGCARC/ASADEL8BDAELIARBCGogAxCwASAEKAIMIQMgBCgCCEEBcUUEQCABKAIEIANBggEQCAwBCxCGASEBIAMQvwFBggEQvwFBASECCyAAIAE2AgQgACACNgIAIARBEGokAAukAQEBfyMAQRBrIgMkAAJAIABFDQAgAkUNAAJAIAFBBE0EQCACQQNqQQJ2QQFrIgFBgAJJDQELIANBpPPEACgCADYCCCAAIANBCGpBouvEAEECED1BpPPEACADKAIINgIADAELIANBpPPEADYCBCADIAFBAnRBpOvEAGoiASgCADYCDCAAIANBDGogA0EEakEDED0gASADKAIMNgIACyADQRBqJAALjAEBAn8jAEEQayICJAAgAkKAgICAwAA3AgQgAkEANgIMIAFBCGsiA0EAIAEgA08bIgFBA3YgAUEHcUEAR2ohAUEIIQMDQCABBEAgAkEEaiADQZykxAAQjAEgAUEBayEBIANBCGohAwwBBSAAIAIpAgQ3AgAgAEEIaiACQQxqKAIANgIAIAJBEGokAAsLC40BAQR/IAEgACgCACAAKAIIIgRrSwRAIAAgBCABQQFBARB5IAAoAgghBAsgACgCBCAEaiEFQQEgASABQQFNGyIGQQFrIQMCQANAIAMEQCAFIAI6AAAgA0EBayEDIAVBAWohBQwBBQJAIAQgBmohAyABDQAgA0EBayEDDAMLCwsgBSACOgAACyAAIAM2AggLAwAAC3oBAn8CfyACRQRAQQEMAQsDQCACQQFNBEACQCABIARBAnRqKAIAIgEgA0cNAEEADAMLBSAEIAJBAXYiBSAEaiIEIAEgBEECdGooAgAgA0sbIQQgAiAFayECDAELCyAEIAEgA0lqIQRBAQshAiAAIAQ2AgQgACACNgIAC5MBAQF/IwBBQGoiAyQAIANCADcDOCADQThqIAAoAgAQAyADIAMoAjwiADYCNCADIAMoAjg2AjAgAyAANgIsIANBATYCKCADQQI2AhAgA0G86cQANgIMIANCATcCGCADIANBLGo2AiQgAyADQSRqNgIUIAEgAiADQQxqEBogAygCLCADKAIwQQFBARCyASADQUBrJAALiAEBAn8jAEEQayIDJAAgAyABKAIAIgUoAgA2AgxBASEEQYAQIAJBAmoiASABbCIBIAFBgBBNGyICQQQgA0EMakEBQQRBBRBdIQEgBSADKAIMNgIAIAEEQCABQgA3AgQgASABIAJBAnRqQQJyNgIAQQAhBAsgACABNgIEIAAgBDYCACADQRBqJAALdgEDfyMAQYABayIDJAAgAC0AACEEQYEBIQADQCAAIANqQQJrIARBD3EiAkEwciACQdcAaiACQQpJGzoAACAEIgJBBHYhBCAAQQFrIQAgAkEPSw0ACyABQY2pxABBAiAAIANqQQFrQYEBIABrEBsgA0GAAWokAAvfAQEEfyMAQRBrIgQkACABKAIIIgMgAk8EQCAEQQhqIAMgAmsiA0EEQRRBtJzEABBtIAQoAgghBSAEKAIMIAEgAjYCCCABKAIEIAJBFGxqIANBFGwQGSEBIAAgAzYCCCAAIAE2AgQgACAFNgIAIARBEGokAA8LIwBBMGsiACQAIAAgAzYCBCAAIAI2AgAgAEEDNgIMIABB3IfEADYCCCAAQgI3AhQgACAAQQRqrUKAgICAsAGENwMoIAAgAK1CgICAgLABhDcDICAAIABBIGo2AhAgAEEIakG0nMQAEJsBAAt+AQN/AkAgACgCACIBQQJxDQAgAUF8cSICRQ0AIAIgAigCBEEDcSAAKAIEQXxxcjYCBCAAKAIAIQELIAAoAgQiAkF8cSIDBEAgAyADKAIAQQNxIAFBfHFyNgIAIAAoAgQhAiAAKAIAIQELIAAgAkEDcTYCBCAAIAFBA3E2AgALfwECfyAAIAEgACgCCCIDayIEEKABIAQEQCADIAFrIQQgASAAKAIIIgFqIANrIQMgACgCBCABQRRsaiEBA0AgAUKggICAEDcCACABQQhqIAIpAAA3AAAgAUEQaiACQQhqLwAAOwAAIAFBFGohASAEQQFqIgQNAAsgACADNgIICwt8AQF/IwBBQGoiBSQAIAUgATYCDCAFIAA2AgggBSADNgIUIAUgAjYCECAFQQI2AhwgBUHcqMQANgIYIAVCAjcCJCAFIAVBEGqtQoCAgICQAYQ3AzggBSAFQQhqrUKAgICAoAGENwMwIAUgBUEwajYCICAFQRhqIAQQmwEAC3YCAX8BfgJAAkAgAa1CDH4iA0IgiKcNACADpyICQXhLDQAgAkEHakF4cSICIAFBCGpqIQEgASACSQ0BIAFB+P///wdNBEAgACACNgIIIAAgATYCBCAAQQg2AgAPCyAAQQA2AgAPCyAAQQA2AgAPCyAAQQA2AgALdgECfyACpyEDQQghBANAIAEgA3EiAyAAaikAAEKAgYKEiJCgwIB/gyICQgBSRQRAIAMgBGohAyAEQQhqIQQMAQsLIAJ6p0EDdiADaiABcSIBIABqLAAAQQBOBH8gACkDAEKAgYKEiJCgwIB/g3qnQQN2BSABCwt0AQZ/IAAoAgQhBiAAKAIAIQICQANAIAEgA0YNAQJAIAIgBkYNACAAIAJBEGoiBzYCACACKAIEIQUgAigCACICQYCAgIB4Rg0AIAIgBRC5ASADQQFqIQMgByECDAELC0GAgICAeCAFELkBIAEgA2shBAsgBAtqAAJ/IAJBAnQiASADQQN0QYCAAWoiAiABIAJLG0GHgARqIgFBEHZAACICQX9GBEBBACECQQEMAQsgAkEQdCICQgA3AgQgAiACIAFBgIB8cWpBAnI2AgBBAAshAyAAIAI2AgQgACADNgIAC3kBAn8jAEHgBWsiASQAIAAQvgEgAUEIaiAAEJ0BIAEoAgxBADYCACABQRBqIgIgAEEEakHQBRAZGiAAQQRB1AUQRSACELMBIAFBNGoQswEgASgCYCABKAJkQQRBBBCyASABKAJsIAEoAnBBAUEBELIBIAFB4AVqJAALgwEBAX8CQAJAAkACQAJAAkACQAJAAkACQAJAIAFBCGsOCAECBgYGAwQFAAtBMiECIAFBhAFrDgoFBgkJBwkJCQkICQsMCAtBGyECDAcLQQYhAgwGC0EsIQIMBQtBKiECDAQLQR8hAgwDC0EgIQIMAgtBHCECDAELQSMhAgsgACACOgAAC2sBB38gACgCCCEDIAAoAgQhBCAALQAMQQFxIQUgACgCACICIQECQANAIAEgBEYEQEEADwsgACABQQRqIgY2AgAgBQ0BIAEoAgAhByAGIQEgAygCACAHTw0ACyABQQRrIQILIABBAToADCACC3sBAn8jAEEQayIDJABBxPPEAEHE88QAKAIAIgRBAWo2AgACQCAEQQBIDQACQEHM88QALQAARQRAQcjzxABByPPEACgCAEEBajYCAEHA88QAKAIAQQBODQEMAgsgA0EIaiAAIAERAAAAC0HM88QAQQA6AAAgAkUNAAALAAtrAQF/IwBBMGsiAyQAIAMgATYCBCADIAA2AgAgA0ECNgIMIANByKjEADYCCCADQgI3AhQgAyADrUKAgICAsAGENwMoIAMgA0EEaq1CgICAgLABhDcDICADIANBIGo2AhAgA0EIaiACEJsBAAtrAQF/IwBBMGsiAyQAIAMgATYCBCADIAA2AgAgA0EDNgIMIANBgIfEADYCCCADQgI3AhQgAyADQQRqrUKAgICAsAGENwMoIAMgA61CgICAgLABhDcDICADIANBIGo2AhAgA0EIaiACEJsBAAtnAQd/IAEoAgghAyABKAIAIQIgASgCBCEGA0ACQCADIQQgAiAGRgRAQQAhBQwBC0EBIQUgASACQQFqIgc2AgAgASAEQQFq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IgIgACgCrAFBAWoiAyABIABBsgFqEEMgACgCYCAAKAJkIAIgAxBiCzMBAn8gACAAKAKoASICIAAoAqwBQQFqIgMgASAAQbIBahAfIAAoAmAgACgCZCACIAMQYgsqACABIAJJBEBBjIrEAEEjQaSLxAAQfwALIAIgACACQRRsaiABIAJrEB0LNQAgACAAKQJ0NwJoIAAgACkBfDcBsgEgACAALwGGATsBvgEgAEG6AWogAEGEAWovAQA7AQAL7AECAn8BfiMAQRBrIgIkACACQQE7AQwgAiABNgIIIAIgADYCBCMAQRBrIgEkACACQQRqIgApAgAhBCABIAA2AgwgASAENwIEIwBBEGsiACQAIAFBBGoiASgCACICKAIMIQMCQAJAAkACQCACKAIEDgIAAQILIAMNAUEBIQJBACEDDAILIAMNACACKAIAIgIoAgQhAyACKAIAIQIMAQsgAEGAgICAeDYCACAAIAE2AgwgASgCCCIBLQAJGiAAQRkgAS0ACBBYAAsgACADNgIEIAAgAjYCACABKAIIIgEtAAkaIABBGiABLQAIEFgACysBAn8CQCAAKAIEIAAoAggiARBAIgJFDQAgASACSQ0AIAAgASACazYCCAsLKAAgASgCAEUEQCABQX82AgAgACABNgIEIAAgAUEEajYCAA8LEM8BAAsmACACBEBBzfPEAC0AABogASACEEEhAQsgACACNgIEIAAgATYCAAsjAQF/IAEgACgCACAAKAIIIgJrSwRAIAAgAiABQQRBEBB5CwsjAQF/IAEgACgCACAAKAIIIgJrSwRAIAAgAiABQQRBFBB5CwslACAAQQE2AgQgACABKAIEIAEoAgBrQQR2IgE2AgggACABNgIACxsAIAEgAk0EQCACIAEgAxBZAAsgACACQRRsagsgACABIAJNBEAgAiABQdilxAAQWQALIAAgAmpBAToAAAsbACABIAJNBEAgAiABIAMQWQALIAAgAkEEdGoLAwAACwMAAAsDAAALAwAACwMAAAsDAAALGgBBzfPEAC0AABpBBCAAEEEiAARAIAAPCwALHQAgAyAAQQJqLQAAEK4BIQAgASACQQEQIiAAEAgLIQAgAEUEQEGUrcQAQTIQzgEACyAAIAIgAyABKAIQEQEACxYAIAFBAXFFBEAgALgQBA8LIACtEAULHwAgAEUEQEGUrcQAQTIQzgEACyAAIAIgASgCEBECAAsbAQF/IAEQACECIAAgATYCBCAAIAJBAUc2AgALGQEBfyAAKAIAIgEEQCAAKAIEQQEgARBFCwsSACAABEAgASACIAAgA2wQRQsLIQEBfyAAKAIQIgEgACgCFBCUASAAKAIMIAFBBEEQELIBCyEBAX8gACgCBCIBIAAoAggQlAEgACgCACABQQRBEBCyAQsWACAAQQFxRQRAQYCAwABBFRDOAQALCxYAIABBEGoQZiAAKAIAIAAoAgQQuQELFAAgACABIAIQDDYCBCAAQQA2AgALGQAgASgCHEGYhMQAQQUgASgCICgCDBEDAAsZACAAQYCAgIB4RwRAIAAgAUEEQRQQsgELCxQAIAEEQEGAgICAeCABELkBCyABCxkAIAEoAhxBwKfEAEEOIAEoAiAoAgwRAwALDwAgAgRAIAAgASACEEULCw8AIAEEQCAAIAIgARBFCwsTACAABEAPC0HM6cQAQRsQzgEACw8AIABBhAFPBEAgABALCwsTACAAKAIIIAAoAgBBAkECELIBCxUAIAIgAhC6ARogAEGAgICAeDYCAAsUACAAKAIAIAEgACgCBCgCDBECAAsQACABIAAoAgQgACgCCBATCwwAIAAEQCABEL8BCws8ACAARQRAIwBBIGsiACQAIABBADYCGCAAQQE2AgwgAEHMhMQANgIIIABCBDcCECAAQQhqIAEQmwEACwALFAAgAEEANgIIIABCgICAgBA3AgALEgAgACABQfiOxAAQb0EBOgAMCxAAIAEgACgCACAAKAIEEBMLawEBfyMAQTBrIgMkACADIAE2AgQgAyAANgIAIANBAjYCDCADQeCrxAA2AgggA0ICNwIUIAMgA0EEaq1CgICAgLABhDcDKCADIAOtQoCAgICwAYQ3AyAgAyADQSBqNgIQIANBCGogAhCbAQALawEBfyMAQTBrIgMkACADIAE2AgQgAyAANgIAIANBAjYCDCADQcCrxAA2AgggA0ICNwIUIAMgA0EEaq1CgICAgLABhDcDKCADIAOtQoCAgICwAYQ3AyAgAyADQSBqNgIQIANBCGogAhCbAQALawEBfyMAQTBrIgMkACADIAE2AgQgAyAANgIAIANBAjYCDCADQZSsxAA2AgggA0ICNwIUIAMgA0EEaq1CgICAgLABhDcDKCADIAOtQoCAgICwAYQ3AyAgAyADQSBqNgIQIANBCGogAhCbAQALDgBB6KfEAEErIAAQfwALCwAgACMAaiQAIwALCQAgACABEA4ACw4AQefpxABBzwAQzgEACw0AIABBoITEACABEBoLDQAgAEHsqMQAIAEQGgsMACAAIAEpAgA3AwALCgAgACgCABC/AQsNACAAQYCAgIB4NgIACwkAIABBADYCAAsGACAAEGYLBQBBgAQLBABBAQsEACABCwQAQQALC+WJASMAQYCAwAALhwJgdW53cmFwX3Rocm93YCBmYWlsZWQAAAAbAAAABAAAAAQAAAAcAAAAY2FsbGVkIGBSZXN1bHQ6OnVud3JhcCgpYCBvbiBhbiBgRXJyYCB2YWx1ZS9uaXgvc3RvcmUvZjdrNWRrd3BxMXlsNzJwOXdyeDhyMHZtMjdrYmpzcmctcnVzdC1kZWZhdWx0LTEuODUuMC9saWIvcnVzdGxpYi9zcmMvcnVzdC9saWJyYXJ5L2FsbG9jL3NyYy9zdHJpbmcucnMAUwAQAHAAAACNBQAAGwAAAE1hcCBrZXkgaXMgbm90IGEgc3RyaW5nIGFuZCBjYW5ub3QgYmUgYW4gb2JqZWN0IGtleQBBgsrAAAsEAQEBAQBBh8zAAAugAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAQbfOwAALAQEAQezOwAALAQEAQajPwAALAQEAQYfSwAALgAIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAEHf2MAACwEBAEGHwsMACwsBAQEBAQEBAQEBAQBBp8PDAAsEAQEBAQBBt8PDAAsoAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQABAAEBAQEBAQEBAQEBAQBBh8bDAAuqAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAEGHyMMAC+QBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAEGBzsMAC74BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQBBh9DDAAvwAwEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAQefWwwALvwMBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAQYfcwwALgg0BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAEGH6sMAC7QCAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAQYeCxAALlANzcmMvbGliLnJzZmdiZ2ZhaW50Ym9sZGl0YWxpY3VuZGVybGluZXN0cmlrZXRocm91Z2hibGlua2ludmVyc2UjAEYBEQABAAAAAQAAAAAAAAABAAAAAAAAAHh3Y3B0VwAABwERAAoAAABEAAAANgAAAAcBEQAKAAAASQAAADYAAAAHAREACgAAAJsAAAAQAAAABwERAAoAAACfAAAAEAAAAAcBEQAKAAAApAAAAC0AAAAHAREACgAAAGcAAAAYAAAABwERAAoAAABxAAAAGAAAAAcBEQAKAAAAkQAAABwAAAAHAREACgAAAIAAAAAYAAAABwERAAoAAACDAAAAFAAAAAcBEQAKAAAAqwAAAC8AAABFcnJvcgAAAB0AAAAMAAAABAAAAB4AAAAfAAAAIAAAAGNhcGFjaXR5IG92ZXJmbG93AAAAOAIRABEAAABsaWJyYXJ5L2FsbG9jL3NyYy9yYXdfdmVjLnJzVAIRABwAAAAoAgAAEQAAAGxpYnJhcnkvYWxsb2Mvc3JjL3N0cmluZy5ycwBBpIXEAAvRIAEAAAAhAAAAYSBmb3JtYXR0aW5nIHRyYWl0IGltcGxlbWVudGF0aW9uIHJldHVybmVkIGFuIGVycm9yIHdoZW4gdGhlIHVuZGVybHlpbmcgc3RyZWFtIGRpZCBub3RsaWJyYXJ5L2FsbG9jL3NyYy9mbXQucnMAAAIDEQAYAAAAigIAAA4AAACAAhEAGwAAAI0FAAAbAAAAKSBzaG91bGQgYmUgPCBsZW4gKGlzIGluc2VydGlvbiBpbmRleCAoaXMgKSBzaG91bGQgYmUgPD0gbGVuIChpcyAAAABSAxEAFAAAAGYDEQAXAAAAuTQRAAEAAAByZW1vdmFsIGluZGV4IChpcyAAAJgDEQASAAAAPAMRABYAAAC5NBEAAQAAAGBhdGAgc3BsaXQgaW5kZXggKGlzIAAAAMQDEQAVAAAAZgMRABcAAAC5NBEAAQAAAC9Vc2Vycy9tYXJjaW4vLmNhcmdvL3JlZ2lzdHJ5L3NyYy9pbmRleC5jcmF0ZXMuaW8tMTk0OWNmOGM2YjViNTU3Zi91bmljb2RlLXdpZHRoLTAuMS4xNC9zcmMvdGFibGVzLnJzAAAA9AMRAGUAAACRAAAAFQAAAPQDEQBlAAAAlwAAABkAAAAvbml4L3N0b3JlL2Y3azVka3dwcTF5bDcycDl3cng4cjB2bTI3a2Jqc3JnLXJ1c3QtZGVmYXVsdC0xLjg1LjAvbGliL3J1c3RsaWIvc3JjL3J1c3QvbGlicmFyeS9jb3JlL3NyYy9pdGVyL3RyYWl0cy9pdGVyYXRvci5ycwAAAHwEEQB9AAAAswcAAAkAAABhc3NlcnRpb24gZmFpbGVkOiBtaWQgPD0gc2VsZi5sZW4oKS9uaXgvc3RvcmUvZjdrNWRrd3BxMXlsNzJwOXdyeDhyMHZtMjdrYmpzcmctcnVzdC1kZWZhdWx0LTEuODUuMC9saWIvcnVzdGxpYi9zcmMvcnVzdC9saWJyYXJ5L2NvcmUvc3JjL3NsaWNlL21vZC5ycwAAAC8FEQByAAAAoA0AAAkAAABhc3NlcnRpb24gZmFpbGVkOiBrIDw9IHNlbGYubGVuKCkAAAAvBREAcgAAAM0NAAAJAAAAL25peC9zdG9yZS9mN2s1ZGt3cHExeWw3MnA5d3J4OHIwdm0yN2tianNyZy1ydXN0LWRlZmF1bHQtMS44NS4wL2xpYi9ydXN0bGliL3NyYy9ydXN0L2xpYnJhcnkvYWxsb2Mvc3JjL3NsaWNlLnJzAOgFEQBvAAAAoQAAABkAAAAvbml4L3N0b3JlL2Y3azVka3dwcTF5bDcycDl3cng4cjB2bTI3a2Jqc3JnLXJ1c3QtZGVmYXVsdC0xLjg1LjAvbGliL3J1c3RsaWIvc3JjL3J1c3QvbGlicmFyeS9hbGxvYy9zcmMvdmVjL21vZC5ycwAAAGgGEQBxAAAAPwoAACQAAABANBEAcQAAACgCAAARAAAAL1VzZXJzL21hcmNpbi8uY2FyZ28vcmVnaXN0cnkvc3JjL2luZGV4LmNyYXRlcy5pby0xOTQ5Y2Y4YzZiNWI1NTdmL2F2dC0wLjE2LjAvc3JjL2J1ZmZlci5ycwD8BhEAWwAAAC0AAAAZAAAA/AYRAFsAAABaAAAADQAAAPwGEQBbAAAAXgAAAA0AAAD8BhEAWwAAAGMAAAANAAAA/AYRAFsAAABoAAAAHQAAAPwG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AAAUAAAAwBERAFkAAAAXAAAAFAAAAMAREQBZAAAAHwAAABQAAAAvVXNlcnMvbWFyY2luLy5jYXJnby9yZWdpc3RyeS9zcmMvaW5kZXguY3JhdGVzLmlvLTE5NDljZjhjNmI1YjU1N2YvYXZ0LTAuMTYuMC9zcmMvdGVybWluYWwvZGlydHlfbGluZXMucnMAAABcEhEAaQAAAAgAAAAUAAAAXBIRAGkAAAAMAAAADwAAAFwSEQBpAAAAEAAAAA8AQYCmxAAL0wcBAAAAIgAAACMAAAAkAAAAJQAAACYAAAAUAAAABAAAACcAAAAoAAAAKQAAACoAAAAvVXNlcnMvbWFyY2luLy5jYXJnby9yZWdpc3RyeS9zcmMvaW5kZXguY3JhdGVzLmlvLTE5NDljZjhjNmI1YjU1N2YvYXZ0LTAuMTYuMC9zcmMvdGVybWluYWwucnMAAAAwExEAXQAAAHUCAAAVAAAAMBMRAF0AAACxAgAADgAAADATEQBdAAAABQQAACMAAABCb3Jyb3dNdXRFcnJvcmFscmVhZHkgYm9ycm93ZWQ6IM4TEQASAAAAY2FsbGVkIGBPcHRpb246OnVud3JhcCgpYCBvbiBhIGBOb25lYCB2YWx1ZWluZGV4IG91dCBvZiBib3VuZHM6IHRoZSBsZW4gaXMgIGJ1dCB0aGUgaW5kZXggaXMgAAAAExQRACAAAAAzFBEAEgAAADogAAABAAAAAAAAAFgUEQACAAAAAAAAAAwAAAAEAAAAKwAAACwAAAAtAAAAICAgICwKKCgKMHgwMDAxMDIwMzA0MDUwNjA3MDgwOTEwMTExMjEzMTQxNTE2MTcxODE5MjAyMTIyMjMyNDI1MjYyNzI4MjkzMDMxMzIzMzM0MzUzNjM3MzgzOTQwNDE0MjQzNDQ0NTQ2NDc0ODQ5NTA1MTUyNTM1NDU1NTY1NzU4NTk2MDYxNjI2MzY0NjU2NjY3Njg2OTcwNzE3MjczNzQ3NTc2Nzc3ODc5ODA4MTgyODM4NDg1ODY4Nzg4ODk5MDkxOTI5Mzk0OTU5Njk3OTg5OWF0dGVtcHRlZCB0byBpbmRleCBzbGljZSB1cCB0byBtYXhpbXVtIHVzaXplAFcVEQAsAAAAcmFuZ2Ugc3RhcnQgaW5kZXggIG91dCBvZiByYW5nZSBmb3Igc2xpY2Ugb2YgbGVuZ3RoIIwVEQASAAAAnhURACIAAAByYW5nZSBlbmQgaW5kZXgg0BURABAAAACeFREAIgAAAHNsaWNlIGluZGV4IHN0YXJ0cyBhdCAgYnV0IGVuZHMgYXQgAPAVEQAWAAAABhYRAA0AAABIYXNoIHRhYmxlIGNhcGFjaXR5IG92ZXJmbG93JBYRABwAAAAvcnVzdC9kZXBzL2hhc2hicm93bi0wLjE1LjIvc3JjL3Jhdy9tb2QucnMAAEgWEQAqAAAAIwAAACgAAAA2NREAbAAAABkBAAASAAAAY2xvc3VyZSBpbnZva2VkIHJlY3Vyc2l2ZWx5IG9yIGFmdGVyIGJlaW5nIGRyb3BwZWQAAP//////////yBYRAEHgrcQAC3UvVXNlcnMvbWFyY2luLy5jYXJnby9yZWdpc3RyeS9zcmMvaW5kZXguY3JhdGVzLmlvLTE5NDljZjhjNmI1YjU1N2Yvc2VyZGUtd2FzbS1iaW5kZ2VuLTAuNi41L3NyYy9saWIucnMAAOAWEQBmAAAANQAAAA4AQYGvxAALhwEBAgMDBAUGBwgJCgsMDQ4DAwMDAwMDDwMDAwMDAwMPCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkQCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkAQYGxxAALnwsBAgICAgMCAgQCBQYHCAkKCwwNDg8QERITFBUWFxgZGhscHQICHgICAgICAgIfICEiIwIkJSYnKCkCKgICAgIrLAICAgItLgICAi8wMTIzAgICAgICNAICNTY3Ajg5Ojs8PT4/OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5QDk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTlBAgJCQwICREVGR0hJAko5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTlLAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICOTk5OUwCAgICAk1OT1ACAgJRAlJTAgICAgICAgICAgICAlRVAgJWAlcCAlhZWltcXV5fYGECYmMCZGVmZwJoAmlqa2wCAm1ub3ACcXICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnMCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ0dQICAgICAgJ2dzk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5eDk5OTk5OTk5OXl6AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ7OTl8OTl9AgICAgICAgICAgICAgICAgICAn4CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ/AgICgIGCAgICAgICAgICAgICAgICg4QCAgICAgICAgIChYZ1AgKHAgICiAICAgICAgKJigICAgICAgICAgICAgKLjAKNjgKPkJGSk5SVlgKXAgKYmZqbAgICAgICAgICAjk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OZwdHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHQICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAJ0CAgICnp8CBAIFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdAgIeAgICAgICAh8gISIjAiQlJicoKQIqAgICAqChoqOkpaYup6ipqqusrTMCAgICAgKuAgI1NjcCODk6Ozw9Pq85OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTlMAgICAgKwTk+xhYZ1AgKHAgICiAICAgICAgKJigICAgICAgICAgICAgKLjLKzjgKPkJGSk5SVlgKXAgKYmZqbAgICAgICAgICAlVVdVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVRVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQBBvLzEAAspVVVVVRUAUFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQEAQe+8xAALxAEQQRBVVVVVVVdVVVVVVVVVVVVRVVUAAEBU9d1VVVVVVVVVVRUAAAAAAFVVVVX8XVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVBQAUABQEUFVVVVVVVVUVUVVVVVVVVVUAAAAAAABAVVVVVVVVVVVV1VdVVVVVVVVVVVVVVQUAAFRVVVVVVVVVVVVVVVVVFQAAVVVRVVVVVVUFEAAAAQFQVVVVVVVVVVVVVQFVVVVVVf////9/VVVVUFUAAFVVVVVVVVVVVVUFAEHAvsQAC5gEQFVVVVVVVVVVVVVVVVVFVAEAVFEBAFVVBVVVVVVVVVVRVVVVVVVVVVVVVVVVVVVEAVRVUVUVVVUFVVVVVVVVRUFVVVVVVVVVVVVVVVVVVVRBFRRQUVVVVVVVVVVQUVVVQVVVVVVVVVVVVVVVVVVVVAEQVFFVVVVVBVVVVVVVBQBRVVVVVVVVVVVVVVVVVVUEAVRVUVUBVVUFVVVVVVVVVUVVVVVVVVVVVVVVVVVVVUVUVVVRVRVVVVVVVVVVVVVVVFRVVVVVVVVVVVVVVVVVBFQFBFBVQVVVBVVVVVVVVVVRVVVVVVVVVVVVVVVVVVUURAUEUFVBVVUFVVVVVVVVVVBVVVVVVVVVVVVVVVVVFUQBVFVBVRVVVQVVVVVVVVVVUVVVVVVVVVVVVVVVVVVVVVVVRRUFRFUVVVVVVVVVVVVVVVVVVVVVVVVVVVVRAEBVVRUAQFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVEAAFRVVQBAVVVVVVVVVVVVVVVVVVVVVVVVUFVVVVVVVRFRVVVVVVVVVVVVVVVVVQEAAEAABFUBAAABAAAAAAAAAABUVUVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVAQQAQUFVVVVVVVVQBVRVVVUBVFVVRUFVUVVVVVFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVWqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqoAQYDDxAALkANVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQFVVVVVVVVVVVVVVVUFVFVVVVVVVQVVVVVVVVVVBVVVVVVVVVUFVVVVf//99//911931tXXVRAAUFVFAQAAVVdRVVVVVVVVVVVVVRUAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVBVVVVVVVVVVVRVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVAFVRVRVUBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVxUUVVVVVVVVVVVVVVVVVVVFAEBEAQBUFQAAFFVVVVVVVVVVVVVVVQAAAAAAAABAVVVVVVVVVVVVVVVVAFVVVVVVVVVVVVVVVQAAUAVVVVVVVVVVVVUVAABVVVVQVVVVVVVVVQVQEFBVVVVVVVVVVVVVVVVVRVARUFVVVVVVVVVVVVVVVVVVAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVAAAAABABUUVVUUFVVVVVVVVVVVVVVVVVVVVVVAEGgxsQAC5MIVVUVAFVVVVVVVQVAVVVVVVVVVVVVVVVVAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQAAAAAAAAAAVFVVVVVVVVVVVfVVVVVpVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX9V9dVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVfVVVVVVVX1VVVVVVVVVVVVVVVf///1VVVVVVVVVVVVXVVVVVVdVVVVVdVfVVVVVVfVVfVXVVV1VVVVV1VfVddV1VXfVVVVVVVVVVV1VVVVVVVVVVd9XfVVVVVVVVVVVVVVVVVVVV/VVVVVVVVVdVVdVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV1VdVVVVVVVVVVVVVVVVXXVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUVUFVVVVVVVVVVVVVVVVVVVf3///////////////9fVdVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVAAAAAAAAAACqqqqqqqqaqqqqqqqqqqqqqqqqqqqqqqqqqqqqqlVVVaqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqWlVVVVVVVaqqqqqqqqqqqqqqqqqqCgCqqqpqqaqqqqqqqqqqqqqqqqqqqqqqqqqqaoGqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqVamqqqqqqqqqqqqqqaqqqqqqqqqqqqqqqqiqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqVVWVqqqqqqqqqqqqqqpqqqqqqqqqqqqqqlVVqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqlVVVVVVVVVVVVVVVVVVVVWqqqpWqqqqqqqqqqqqqqqqqmpVVVVVVVVVVVVVVVVVX1VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVRVAAABQVVVVVVVVVQVVVVVVVVVVVVVVVVVVVVVVVVVVVVBVVVVFRRVVVVVVVVVBVVRVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUFVVVVVVVQAAAABQVUUVVVVVVVVVVVVVBQBQVVVVVVUVAABQVVVVqqqqqqqqqlZAVVVVVVVVVVVVVVUVBVBQVVVVVVVVVVVVUVVVVVVVVVVVVVVVVVVVVVUBQEFBVVUVVVVUVVVVVVVVVVVVVVVUVVVVVVVVVVVVVVVVBBRUBVFVVVVVVVVVVVVVUFVFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUVRRVVVVVaqqqqqqqqqqqlVVVQAAAAAAQBUAQb/OxAAL4QxVVVVVVVVVVUVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUAAADwqqpaVQAAAACqqqqqqqqqqmqqqqqqaqpVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUVqaqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqVlVVVVVVVVVVVVVVVVVVBVRVVVVVVVVVVVVVVVVVVVWqalVVAABUVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVRVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQVAVQFBVQBVVVVVVVVVVVVVQBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUFVVVVVVVXVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVRVUVVVVVVVVVVVVVVVVVVVVVVVVVQFVVVVVVVVVVVVVVVVVVVVVVQUAAFRVVVVVVVVVVVVVVQVQVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUVVVVVVVVVVVVVVVVVUAAABAVVVVVVVVVVVVVRRUVRVQVVVVVVVVVVVVVVUVQEFVRVVVVVVVVVVVVVVVVVVVVUBVVVVVVVVVVRUAAQBUVVVVVVVVVVVVVVVVVVUVVVVVUFVVVVVVVVVVVVVVVQUAQAVVARRVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVRVQBFVFUVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVFRUAQFVVVVVVUFVVVVVVVVVVVVVVVVUVRFRVVVVVFVVVVQUAVABUVVVVVVVVVVVVVVVVVVVVVQAABURVVVVVVUVVVVVVVVVVVVVVVVVVVVVVVVVVVRQARBEEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUVBVBVEFRVVVVVVVVQVVVVVVVVVVVVVVVVVVVVVVVVVVUVAEARVFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUVUQAQVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQEFEABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVRUAAEFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVRVFQQRVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVAAVVVFVVVVVVVVUBAEBVVVVVVVVVVVUVAARAVRVVVQFAAVVVVVVVVVVVVVUAAAAAQFBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVAEAAEFVVVVVVVVVVVVVVVVVVVVVVVVVVBQAAAAAABQAEQVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQFARRAAAFVVVVVVVVVVVVVVVVVVVVVVVVARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVFVRVVUBVVVVVVVVVVVVVVVUFQFVEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQVAAAAUFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVAFRVVVVVVVVVVVVVVVVVVQBAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVRVVVVVVVVVVVVVVVVVVVVUVQFVVVVVVVVVVVVVVVVVVVVVVVVWqVFVVWlVVVaqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqlVVqqqqqqqqqqqqqqqqqqqqqqqqqqqqWlVVVVVVVVVVVVWqqlZVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVWqqappqqqqqqqqqqpqVVVVZVVVVVVVVVVqWVVVVapVVaqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqVVVVVVVVVVVBAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVAEGr28QAC3VQAAAAAABAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVEVAFAAAAAEABAFVVVVVVVVUFUFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQVUVVVVVVVVVVVVVVVVVVUAQa3cxAALAkAVAEG73MQAC8UGVFVRVVVVVFVVVVUVAAEAAABVVVVVVVVVVVVVVVVVVVVVVVVVVQBAAAAAABQAEARAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUVVVVVVVVVVVVVVVVVVVVUAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUAQFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQBAVVVVVVVVVVVVVVVVVVVXVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVdVVVVVVVVVVVVVVVVVVVVV1/f9/VVVVVVVVVVVVVVVVVVVVVVVV9f///////25VVVWqqrqqqqqq6vq/v1WqqlZVX1VVVapaVVVVVVVV//////////9XVVX9/9////////////////////////f//////1VVVf////////////9/1f9VVVX/////V1f//////////////////////3/3/////////////////////////////////////////////////////////////9f///////////////////9fVVXVf////////1VVVVV1VVVVVVVVfVVVVVdVVVVVVVVVVVVVVVVVVVVVVVVVVdX///////////////////////////9VVVVVVVVVVVVVVVX//////////////////////19VV3/9Vf9VVdVXVf//V1VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf///1VXVVVVVVVV//////////////9////f/////////////////////////////////////////////////////////////1VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX///9X//9XVf//////////////3/9fVfX///9V//9XVf//V1WqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqWlVVVVVVVVVVWZZVYaqlWapVVVVVVZVVVVVVVVVVlVVVAEGO48QACwEDAEGc48QAC4YIVVVVVVWVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUVAJZqWlpqqgVAplmVZVVVVVVVVVVVAAAAAFVWVVWpVlVVVVVVVVVVVVZVVVVVVVVVVQAAAAAAAAAAVFVVVZVZWVVVZVVVaVVVVVVVVVVVVVVVlVaVaqqqqlWqqlpVVVVZVaqqqlVVVVVlVVVaVVVVVaVlVlVVVZVVVVVVVVWmlpqWWVllqZaqqmZVqlVaWVVaVmVVVVVqqqWlWlVVVaWqWlVVWVlVVVlVVVVVVZVVVVVVVVVVVVVVVVVVVVVVVVVVVWVV9VVVVWlVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVWqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqmqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqlWqqqqqqqqqqqpVVVWqqqqqpVpVVZqqWlWlpVVaWqWWpVpVVVWlWlWVVVVVfVVpWaVVX1VmVVVVVVVVVVVmVf///1VVVZqaappVVVXVVVVVVdVVVaVdVfVVVVVVvVWvqrqqq6qqmlW6qvquuq5VXfVVVVVVVVVVV1VVVVVZVVVVd9XfVVVVVVVVVaWqqlVVVVVVVdVXVVVVVVVVVVVVVVVVV61aVVVVVVVVVVVVqqqqqqqqqmqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqoAAADAqqpaVQAAAACqqqqqqqqqqmqqqqqqaqpVVVVVVVVVVVVVVVUFVFVVVVVVVVVVVVVVVVVVVapqVVUAAFRZqqpqVaqqqqqqqqpaqqqqqqqqqqqqqqqqqqpaVaqqqqqqqqq6/v+/qqqqqlZVVVVVVVVVVVVVVVVV9f///////y9uaXgvc3RvcmUvZjdrNWRrd3BxMXlsNzJwOXdyeDhyMHZtMjdrYmpzcmctcnVzdC1kZWZhdWx0LTEuODUuMC9saWIvcnVzdGxpYi9zcmMvcnVzdC9saWJyYXJ5L2FsbG9jL3NyYy9yYXdfdmVjLnJzSnNWYWx1ZSgpAACxNBEACAAAALk0EQABAAAAbnVsbCBwb2ludGVyIHBhc3NlZCB0byBydXN0cmVjdXJzaXZlIHVzZSBvZiBhbiBvYmplY3QgZGV0ZWN0ZWQgd2hpY2ggd291bGQgbGVhZCB0byB1bnNhZmUgYWxpYXNpbmcgaW4gcnVzdC9Vc2Vycy9tYXJjaW4vLmNhcmdvL3JlZ2lzdHJ5L3NyYy9pbmRleC5jcmF0ZXMuaW8tMTk0OWNmOGM2YjViNTU3Zi93YXNtLWJpbmRnZW4tMC4yLjkyL3NyYy9jb252ZXJ0L3NsaWNlcy5ycwBHCXByb2R1Y2VycwEMcHJvY2Vzc2VkLWJ5AgZ3YWxydXMGMC4yMC4zDHdhc20tYmluZGdlbhIwLjIuOTIgKDJhNGE0OTM2Mik=");

          var loadVt = async (opt = {}) => {
                  let {initializeHook} = opt;

                  if (initializeHook != null) {
                      await initializeHook(__wbg_init, wasm_code);

                  } else {
                      await __wbg_init(wasm_code);
                  }

                  return exports$1;
              };

  class Clock {
    constructor() {
      let speed = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1.0;
      this.speed = speed;
      this.startTime = performance.now();
    }
    getTime() {
      return this.speed * (performance.now() - this.startTime) / 1000.0;
    }
    setTime(time) {
      this.startTime = performance.now() - time / this.speed * 1000.0;
    }
  }
  class NullClock {
    constructor() {}
    getTime(_speed) {}
    setTime(_time) {}
  }

  // Efficient array transformations without intermediate array objects.
  // Inspired by Elixir's streams and Rust's iterator adapters.

  class Stream {
    constructor(input, xfs) {
      this.input = typeof input.next === "function" ? input : input[Symbol.iterator]();
      this.xfs = xfs ?? [];
    }
    map(f) {
      return this.transform(Map$1(f));
    }
    flatMap(f) {
      return this.transform(FlatMap(f));
    }
    filter(f) {
      return this.transform(Filter(f));
    }
    take(n) {
      return this.transform(Take(n));
    }
    drop(n) {
      return this.transform(Drop(n));
    }
    transform(f) {
      return new Stream(this.input, this.xfs.concat([f]));
    }
    multiplex(other, comparator) {
      return new Stream(new Multiplexer(this[Symbol.iterator](), other[Symbol.iterator](), comparator));
    }
    toArray() {
      return Array.from(this);
    }
    [Symbol.iterator]() {
      let v = 0;
      let values = [];
      let flushed = false;
      const xf = compose(this.xfs, val => values.push(val));
      return {
        next: () => {
          if (v === values.length) {
            values = [];
            v = 0;
          }
          while (values.length === 0) {
            const next = this.input.next();
            if (next.done) {
              break;
            } else {
              xf.step(next.value);
            }
          }
          if (values.length === 0 && !flushed) {
            xf.flush();
            flushed = true;
          }
          if (values.length > 0) {
            return {
              done: false,
              value: values[v++]
            };
          } else {
            return {
              done: true
            };
          }
        }
      };
    }
  }
  function Map$1(f) {
    return emit => {
      return input => {
        emit(f(input));
      };
    };
  }
  function FlatMap(f) {
    return emit => {
      return input => {
        f(input).forEach(emit);
      };
    };
  }
  function Filter(f) {
    return emit => {
      return input => {
        if (f(input)) {
          emit(input);
        }
      };
    };
  }
  function Take(n) {
    let c = 0;
    return emit => {
      return input => {
        if (c < n) {
          emit(input);
        }
        c += 1;
      };
    };
  }
  function Drop(n) {
    let c = 0;
    return emit => {
      return input => {
        c += 1;
        if (c > n) {
          emit(input);
        }
      };
    };
  }
  function compose(xfs, push) {
    return xfs.reverse().reduce((next, curr) => {
      const xf = toXf(curr(next.step));
      return {
        step: xf.step,
        flush: () => {
          xf.flush();
          next.flush();
        }
      };
    }, toXf(push));
  }
  function toXf(xf) {
    if (typeof xf === "function") {
      return {
        step: xf,
        flush: () => {}
      };
    } else {
      return xf;
    }
  }
  class Multiplexer {
    constructor(left, right, comparator) {
      this.left = left;
      this.right = right;
      this.comparator = comparator;
    }
    [Symbol.iterator]() {
      let leftItem;
      let rightItem;
      return {
        next: () => {
          if (leftItem === undefined && this.left !== undefined) {
            const result = this.left.next();
            if (result.done) {
              this.left = undefined;
            } else {
              leftItem = result.value;
            }
          }
          if (rightItem === undefined && this.right !== undefined) {
            const result = this.right.next();
            if (result.done) {
              this.right = undefined;
            } else {
              rightItem = result.value;
            }
          }
          if (leftItem === undefined && rightItem === undefined) {
            return {
              done: true
            };
          } else if (leftItem === undefined) {
            const value = rightItem;
            rightItem = undefined;
            return {
              done: false,
              value: value
            };
          } else if (rightItem === undefined) {
            const value = leftItem;
            leftItem = undefined;
            return {
              done: false,
              value: value
            };
          } else if (this.comparator(leftItem, rightItem)) {
            const value = leftItem;
            leftItem = undefined;
            return {
              done: false,
              value: value
            };
          } else {
            const value = rightItem;
            rightItem = undefined;
            return {
              done: false,
              value: value
            };
          }
        }
      };
    }
  }

  async function parse$2(data) {
    if (data instanceof Response) {
      const text = await data.text();
      const result = parseJsonl(text);
      if (result !== undefined) {
        const {
          header,
          events
        } = result;
        if (header.version === 2) {
          return parseAsciicastV2(header, events);
        } else if (header.version === 3) {
          return parseAsciicastV3(header, events);
        } else {
          throw `asciicast v${header.version} format not supported`;
        }
      } else {
        const header = JSON.parse(text);
        if (header.version === 1) {
          return parseAsciicastV1(header);
        }
      }
    } else if (typeof data === "object" && data.version === 1) {
      return parseAsciicastV1(data);
    } else if (Array.isArray(data)) {
      const header = data[0];
      if (header.version === 2) {
        const events = data.slice(1, data.length);
        return parseAsciicastV2(header, events);
      } else if (header.version === 3) {
        const events = data.slice(1, data.length);
        return parseAsciicastV3(header, events);
      } else {
        throw `asciicast v${header.version} format not supported`;
      }
    }
    throw "invalid data";
  }
  function parseJsonl(jsonl) {
    const lines = jsonl.split("\n");
    let header;
    try {
      header = JSON.parse(lines[0]);
    } catch (_error) {
      return;
    }
    const events = new Stream(lines).drop(1).filter(l => l[0] === "[").map(JSON.parse);
    return {
      header,
      events
    };
  }
  function parseAsciicastV1(data) {
    let time = 0;
    const events = new Stream(data.stdout).map(e => {
      time += e[0];
      return [time, "o", e[1]];
    });
    return {
      cols: data.width,
      rows: data.height,
      events
    };
  }
  function parseAsciicastV2(header, events) {
    return {
      cols: header.width,
      rows: header.height,
      theme: parseTheme$1(header.theme),
      events,
      idleTimeLimit: header.idle_time_limit
    };
  }
  function parseAsciicastV3(header, events) {
    if (!(events instanceof Stream)) {
      events = new Stream(events);
    }
    let time = 0;
    events = events.map(e => {
      time += e[0];
      return [time, e[1], e[2]];
    });
    return {
      cols: header.term.cols,
      rows: header.term.rows,
      theme: parseTheme$1(header.term?.theme),
      events,
      idleTimeLimit: header.idle_time_limit
    };
  }
  function parseTheme$1(theme) {
    if (theme === undefined) return;
    const colorRegex = /^#[0-9A-Fa-f]{6}$/;
    const paletteRegex = /^(#[0-9A-Fa-f]{6}:){7,}#[0-9A-Fa-f]{6}$/;
    const fg = theme?.fg;
    const bg = theme?.bg;
    const palette = theme?.palette;
    if (colorRegex.test(fg) && colorRegex.test(bg) && paletteRegex.test(palette)) {
      return {
        foreground: fg,
        background: bg,
        palette: palette.split(":")
      };
    }
  }
  function unparseAsciicastV2(recording) {
    const header = JSON.stringify({
      version: 2,
      width: recording.cols,
      height: recording.rows
    });
    const events = recording.events.map(JSON.stringify).join("\n");
    return `${header}\n${events}\n`;
  }

  function recording(src, _ref, _ref2) {
    let {
      feed,
      resize,
      onInput,
      onMarker,
      setState,
      logger
    } = _ref;
    let {
      speed,
      idleTimeLimit,
      startAt,
      loop,
      posterTime,
      markers: markers_,
      pauseOnMarkers,
      cols: initialCols,
      rows: initialRows,
      audioUrl
    } = _ref2;
    let cols;
    let rows;
    let events;
    let markers;
    let duration;
    let effectiveStartAt;
    let eventTimeoutId;
    let nextEventIndex = 0;
    let lastEventTime = 0;
    let startTime;
    let pauseElapsedTime;
    let playCount = 0;
    let waitingForAudio = false;
    let waitingTimeout;
    let shouldResumeOnAudioPlaying = false;
    let now = () => performance.now() * speed;
    let audioCtx;
    let audioElement;
    let audioSeekable = false;
    async function init() {
      const timeout = setTimeout(() => {
        setState("loading");
      }, 3000);
      try {
        let metadata = loadRecording(src, logger, {
          idleTimeLimit,
          startAt,
          markers_
        });
        const hasAudio = await loadAudio(audioUrl);
        metadata = await metadata;
        return {
          ...metadata,
          hasAudio
        };
      } finally {
        clearTimeout(timeout);
      }
    }
    async function loadRecording(src, logger, opts) {
      const {
        parser,
        minFrameTime,
        inputOffset,
        dumpFilename,
        encoding = "utf-8"
      } = src;
      const data = await doFetch(src);
      const recording = prepare(await parser(data, {
        encoding
      }), logger, {
        ...opts,
        minFrameTime,
        inputOffset
      });
      ({
        cols,
        rows,
        events,
        duration,
        effectiveStartAt
      } = recording);
      initialCols = initialCols ?? cols;
      initialRows = initialRows ?? rows;
      if (events.length === 0) {
        throw "recording is missing events";
      }
      if (dumpFilename !== undefined) {
        dump(recording, dumpFilename);
      }
      const poster = posterTime !== undefined ? getPoster(posterTime) : undefined;
      markers = events.filter(e => e[1] === "m").map(e => [e[0], e[2].label]);
      return {
        cols,
        rows,
        duration,
        theme: recording.theme,
        poster,
        markers
      };
    }
    async function loadAudio(audioUrl) {
      if (!audioUrl) return false;
      audioElement = await createAudioElement(audioUrl);
      audioSeekable = !Number.isNaN(audioElement.duration) && audioElement.duration !== Infinity && audioElement.seekable.length > 0 && audioElement.seekable.end(audioElement.seekable.length - 1) === audioElement.duration;
      if (audioSeekable) {
        audioElement.addEventListener("playing", onAudioPlaying);
        audioElement.addEventListener("waiting", onAudioWaiting);
      } else {
        logger.warn(`audio is not seekable - you must enable range request support on the server providing ${audioElement.src} for audio seeking to work`);
      }
      return true;
    }
    async function doFetch(_ref3) {
      let {
        url,
        data,
        fetchOpts = {}
      } = _ref3;
      if (typeof url === "string") {
        return await doFetchOne(url, fetchOpts);
      } else if (Array.isArray(url)) {
        return await Promise.all(url.map(url => doFetchOne(url, fetchOpts)));
      } else if (data !== undefined) {
        if (typeof data === "function") {
          data = data();
        }
        if (!(data instanceof Promise)) {
          data = Promise.resolve(data);
        }
        const value = await data;
        if (typeof value === "string" || value instanceof ArrayBuffer) {
          return new Response(value);
        } else {
          return value;
        }
      } else {
        throw "failed fetching recording file: url/data missing in src";
      }
    }
    async function doFetchOne(url, fetchOpts) {
      const response = await fetch(url, fetchOpts);
      if (!response.ok) {
        throw `failed fetching recording from ${url}: ${response.status} ${response.statusText}`;
      }
      return response;
    }
    function scheduleNextEvent() {
      const nextEvent = events[nextEventIndex];
      if (nextEvent) {
        eventTimeoutId = scheduleAt(runNextEvent, nextEvent[0]);
      } else {
        onEnd();
      }
    }
    function scheduleAt(f, targetTime) {
      let timeout = (targetTime * 1000 - (now() - startTime)) / speed;
      if (timeout < 0) {
        timeout = 0;
      }
      return setTimeout(f, timeout);
    }
    function runNextEvent() {
      let event = events[nextEventIndex];
      let elapsedWallTime;
      do {
        lastEventTime = event[0];
        nextEventIndex++;
        const stop = executeEvent(event);
        if (stop) {
          return;
        }
        event = events[nextEventIndex];
        elapsedWallTime = now() - startTime;
      } while (event && elapsedWallTime > event[0] * 1000);
      scheduleNextEvent();
    }
    function cancelNextEvent() {
      clearTimeout(eventTimeoutId);
      eventTimeoutId = null;
    }
    function executeEvent(event) {
      const [time, type, data] = event;
      if (type === "o") {
        feed(data);
      } else if (type === "i") {
        onInput(data);
      } else if (type === "r") {
        const [cols, rows] = data.split("x");
        resize(cols, rows);
      } else if (type === "m") {
        onMarker(data);
        if (pauseOnMarkers) {
          pause();
          pauseElapsedTime = time * 1000;
          setState("idle", {
            reason: "paused"
          });
          return true;
        }
      }
      return false;
    }
    function onEnd() {
      cancelNextEvent();
      playCount++;
      if (loop === true || typeof loop === "number" && playCount < loop) {
        nextEventIndex = 0;
        startTime = now();
        feed("\x1bc"); // reset terminal
        resizeTerminalToInitialSize();
        scheduleNextEvent();
        if (audioElement) {
          audioElement.currentTime = 0;
        }
      } else {
        pauseElapsedTime = duration * 1000;
        setState("ended");
        if (audioElement) {
          audioElement.pause();
        }
      }
    }
    async function play() {
      if (eventTimeoutId) throw "already playing";
      if (events[nextEventIndex] === undefined) throw "already ended";
      if (effectiveStartAt !== null) {
        seek(effectiveStartAt);
      }
      await resume();
      return true;
    }
    function pause() {
      shouldResumeOnAudioPlaying = false;
      if (audioElement) {
        audioElement.pause();
      }
      if (!eventTimeoutId) return true;
      cancelNextEvent();
      pauseElapsedTime = now() - startTime;
      return true;
    }
    async function resume() {
      if (audioElement && !audioCtx) setupAudioCtx();
      startTime = now() - pauseElapsedTime;
      pauseElapsedTime = null;
      scheduleNextEvent();
      if (audioElement) {
        await audioElement.play();
      }
    }
    async function seek(where) {
      if (waitingForAudio) {
        return false;
      }
      const isPlaying = !!eventTimeoutId;
      pause();
      if (audioElement) {
        audioElement.pause();
      }
      const currentTime = (pauseElapsedTime ?? 0) / 1000;
      if (typeof where === "string") {
        if (where === "<<") {
          where = currentTime - 5;
        } else if (where === ">>") {
          where = currentTime + 5;
        } else if (where === "<<<") {
          where = currentTime - 0.1 * duration;
        } else if (where === ">>>") {
          where = currentTime + 0.1 * duration;
        } else if (where[where.length - 1] === "%") {
          where = parseFloat(where.substring(0, where.length - 1)) / 100 * duration;
        }
      } else if (typeof where === "object") {
        if (where.marker === "prev") {
          where = findMarkerTimeBefore(currentTime) ?? 0;
          if (isPlaying && currentTime - where < 1) {
            where = findMarkerTimeBefore(where) ?? 0;
          }
        } else if (where.marker === "next") {
          where = findMarkerTimeAfter(currentTime) ?? duration;
        } else if (typeof where.marker === "number") {
          const marker = markers[where.marker];
          if (marker === undefined) {
            throw `invalid marker index: ${where.marker}`;
          } else {
            where = marker[0];
          }
        }
      }
      const targetTime = Math.min(Math.max(where, 0), duration);
      if (targetTime * 1000 === pauseElapsedTime) return false;
      if (targetTime < lastEventTime) {
        feed("\x1bc"); // reset terminal
        resizeTerminalToInitialSize();
        nextEventIndex = 0;
        lastEventTime = 0;
      }
      let event = events[nextEventIndex];
      while (event && event[0] <= targetTime) {
        if (event[1] === "o" || event[1] === "r") {
          executeEvent(event);
        }
        lastEventTime = event[0];
        event = events[++nextEventIndex];
      }
      pauseElapsedTime = targetTime * 1000;
      effectiveStartAt = null;
      if (audioElement && audioSeekable) {
        audioElement.currentTime = targetTime / speed;
      }
      if (isPlaying) {
        await resume();
      } else if (events[nextEventIndex] === undefined) {
        onEnd();
      }
      return true;
    }
    function findMarkerTimeBefore(time) {
      if (markers.length == 0) return;
      let i = 0;
      let marker = markers[i];
      let lastMarkerTimeBefore;
      while (marker && marker[0] < time) {
        lastMarkerTimeBefore = marker[0];
        marker = markers[++i];
      }
      return lastMarkerTimeBefore;
    }
    function findMarkerTimeAfter(time) {
      if (markers.length == 0) return;
      let i = markers.length - 1;
      let marker = markers[i];
      let firstMarkerTimeAfter;
      while (marker && marker[0] > time) {
        firstMarkerTimeAfter = marker[0];
        marker = markers[--i];
      }
      return firstMarkerTimeAfter;
    }
    function step(n) {
      if (n === undefined) {
        n = 1;
      }
      let nextEvent;
      let targetIndex;
      if (n > 0) {
        let index = nextEventIndex;
        nextEvent = events[index];
        for (let i = 0; i < n; i++) {
          while (nextEvent !== undefined && nextEvent[1] !== "o") {
            nextEvent = events[++index];
          }
          if (nextEvent !== undefined && nextEvent[1] === "o") {
            targetIndex = index;
          }
        }
      } else {
        let index = Math.max(nextEventIndex - 2, 0);
        nextEvent = events[index];
        for (let i = n; i < 0; i++) {
          while (nextEvent !== undefined && nextEvent[1] !== "o") {
            nextEvent = events[--index];
          }
          if (nextEvent !== undefined && nextEvent[1] === "o") {
            targetIndex = index;
          }
        }
        if (targetIndex !== undefined) {
          feed("\x1bc"); // reset terminal
          resizeTerminalToInitialSize();
          nextEventIndex = 0;
        }
      }
      if (targetIndex === undefined) return;
      while (nextEventIndex <= targetIndex) {
        nextEvent = events[nextEventIndex++];
        if (nextEvent[1] === "o" || nextEvent[1] === "r") {
          executeEvent(nextEvent);
        }
      }
      lastEventTime = nextEvent[0];
      pauseElapsedTime = lastEventTime * 1000;
      effectiveStartAt = null;
      if (audioElement && audioSeekable) {
        audioElement.currentTime = lastEventTime / speed;
      }
      if (events[targetIndex + 1] === undefined) {
        onEnd();
      }
    }
    async function restart() {
      if (eventTimeoutId) throw "still playing";
      if (events[nextEventIndex] !== undefined) throw "not ended";
      seek(0);
      await resume();
      return true;
    }
    function getPoster(time) {
      return events.filter(e => e[0] < time && e[1] === "o").map(e => e[2]);
    }
    function getCurrentTime() {
      if (eventTimeoutId) {
        return (now() - startTime) / 1000;
      } else {
        return (pauseElapsedTime ?? 0) / 1000;
      }
    }
    function resizeTerminalToInitialSize() {
      resize(initialCols, initialRows);
    }
    function setupAudioCtx() {
      audioCtx = new AudioContext({
        latencyHint: "interactive"
      });
      const src = audioCtx.createMediaElementSource(audioElement);
      src.connect(audioCtx.destination);
      now = audioNow;
    }
    function audioNow() {
      if (!audioCtx) throw "audio context not started - can't tell time!";
      const {
        contextTime,
        performanceTime
      } = audioCtx.getOutputTimestamp();

      // The check below is needed for Chrome,
      // which returns 0 for first several dozen millis,
      // completely ruining the timing (the clock jumps backwards once),
      // therefore we initially ignore performanceTime in our calculation.

      return performanceTime === 0 ? contextTime * 1000 : contextTime * 1000 + (performance.now() - performanceTime);
    }
    function onAudioWaiting() {
      logger.debug("audio buffering");
      waitingForAudio = true;
      shouldResumeOnAudioPlaying = !!eventTimeoutId;
      waitingTimeout = setTimeout(() => setState("loading"), 1000);
      if (!eventTimeoutId) return true;
      logger.debug("pausing session playback");
      cancelNextEvent();
      pauseElapsedTime = now() - startTime;
    }
    function onAudioPlaying() {
      logger.debug("audio resumed");
      clearTimeout(waitingTimeout);
      setState("playing");
      if (!waitingForAudio) return;
      waitingForAudio = false;
      if (shouldResumeOnAudioPlaying) {
        logger.debug("resuming session playback");
        startTime = now() - pauseElapsedTime;
        pauseElapsedTime = null;
        scheduleNextEvent();
      }
    }
    function mute() {
      if (audioElement) {
        audioElement.muted = true;
        return true;
      }
    }
    function unmute() {
      if (audioElement) {
        audioElement.muted = false;
        return true;
      }
    }
    return {
      init,
      play,
      pause,
      seek,
      step,
      restart,
      stop: pause,
      mute,
      unmute,
      getCurrentTime
    };
  }
  function batcher(logger) {
    let minFrameTime = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1.0 / 60;
    let prevEvent;
    return emit => {
      let ic = 0;
      let oc = 0;
      return {
        step: event => {
          ic++;
          if (prevEvent === undefined) {
            prevEvent = event;
            return;
          }
          if (event[1] === "o" && prevEvent[1] === "o" && event[0] - prevEvent[0] < minFrameTime) {
            prevEvent[2] += event[2];
          } else {
            emit(prevEvent);
            prevEvent = event;
            oc++;
          }
        },
        flush: () => {
          if (prevEvent !== undefined) {
            emit(prevEvent);
            oc++;
          }
          logger.debug(`batched ${ic} frames to ${oc} frames`);
        }
      };
    };
  }
  function prepare(recording, logger, _ref4) {
    let {
      startAt = 0,
      idleTimeLimit,
      minFrameTime,
      inputOffset,
      markers_
    } = _ref4;
    let {
      events
    } = recording;
    if (!(events instanceof Stream)) {
      events = new Stream(events);
    }
    idleTimeLimit = idleTimeLimit ?? recording.idleTimeLimit ?? Infinity;
    const limiterOutput = {
      offset: 0
    };
    events = events.transform(batcher(logger, minFrameTime)).map(timeLimiter(idleTimeLimit, startAt, limiterOutput)).map(markerWrapper());
    if (markers_ !== undefined) {
      markers_ = new Stream(markers_).map(normalizeMarker);
      events = events.filter(e => e[1] !== "m").multiplex(markers_, (a, b) => a[0] < b[0]).map(markerWrapper());
    }
    events = events.toArray();
    if (inputOffset !== undefined) {
      events = events.map(e => e[1] === "i" ? [e[0] + inputOffset, e[1], e[2]] : e);
      events.sort((a, b) => a[0] - b[0]);
    }
    const duration = events[events.length - 1][0];
    const effectiveStartAt = startAt - limiterOutput.offset;
    return {
      ...recording,
      events,
      duration,
      effectiveStartAt
    };
  }
  function normalizeMarker(m) {
    return typeof m === "number" ? [m, "m", ""] : [m[0], "m", m[1]];
  }
  function timeLimiter(idleTimeLimit, startAt, output) {
    let prevT = 0;
    let shift = 0;
    return function (e) {
      const delay = e[0] - prevT;
      const delta = delay - idleTimeLimit;
      prevT = e[0];
      if (delta > 0) {
        shift += delta;
        if (e[0] < startAt) {
          output.offset += delta;
        }
      }
      return [e[0] - shift, e[1], e[2]];
    };
  }
  function markerWrapper() {
    let i = 0;
    return function (e) {
      if (e[1] === "m") {
        return [e[0], e[1], {
          index: i++,
          time: e[0],
          label: e[2]
        }];
      } else {
        return e;
      }
    };
  }
  function dump(recording, filename) {
    const link = document.createElement("a");
    const events = recording.events.map(e => e[1] === "m" ? [e[0], e[1], e[2].label] : e);
    const asciicast = unparseAsciicastV2({
      ...recording,
      events
    });
    link.href = URL.createObjectURL(new Blob([asciicast], {
      type: "text/plain"
    }));
    link.download = filename;
    link.click();
  }
  async function createAudioElement(src) {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.loop = false;
    audio.crossOrigin = "anonymous";
    let resolve;
    const canPlay = new Promise(resolve_ => {
      resolve = resolve_;
    });
    function onCanPlay() {
      resolve();
      audio.removeEventListener("canplay", onCanPlay);
    }
    audio.addEventListener("canplay", onCanPlay);
    audio.src = src;
    audio.load();
    await canPlay;
    return audio;
  }

  function clock(_ref, _ref2, _ref3) {
    let {
      hourColor = 3,
      minuteColor = 4,
      separatorColor = 9
    } = _ref;
    let {
      feed
    } = _ref2;
    let {
      cols = 5,
      rows = 1
    } = _ref3;
    const middleRow = Math.floor(rows / 2);
    const leftPad = Math.floor(cols / 2) - 2;
    const setupCursor = `\x1b[?25l\x1b[1m\x1b[${middleRow}B`;
    let intervalId;
    const getCurrentTime = () => {
      const d = new Date();
      const h = d.getHours();
      const m = d.getMinutes();
      const seqs = [];
      seqs.push("\r");
      for (let i = 0; i < leftPad; i++) {
        seqs.push(" ");
      }
      seqs.push(`\x1b[3${hourColor}m`);
      if (h < 10) {
        seqs.push("0");
      }
      seqs.push(`${h}`);
      seqs.push(`\x1b[3${separatorColor};5m:\x1b[25m`);
      seqs.push(`\x1b[3${minuteColor}m`);
      if (m < 10) {
        seqs.push("0");
      }
      seqs.push(`${m}`);
      return seqs;
    };
    const updateTime = () => {
      getCurrentTime().forEach(feed);
    };
    return {
      init: () => {
        const duration = 24 * 60;
        const poster = [setupCursor].concat(getCurrentTime());
        return {
          cols,
          rows,
          duration,
          poster
        };
      },
      play: () => {
        feed(setupCursor);
        updateTime();
        intervalId = setInterval(updateTime, 1000);
        return true;
      },
      stop: () => {
        clearInterval(intervalId);
      },
      getCurrentTime: () => {
        const d = new Date();
        return d.getHours() * 60 + d.getMinutes();
      }
    };
  }

  function random(src, _ref, _ref2) {
    let {
      feed
    } = _ref;
    let {
      speed
    } = _ref2;
    const base = " ".charCodeAt(0);
    const range = "~".charCodeAt(0) - base;
    let timeoutId;
    const schedule = () => {
      const t = Math.pow(5, Math.random() * 4);
      timeoutId = setTimeout(print, t / speed);
    };
    const print = () => {
      schedule();
      const char = String.fromCharCode(base + Math.floor(Math.random() * range));
      feed(char);
    };
    return () => {
      schedule();
      return () => clearInterval(timeoutId);
    };
  }

  function benchmark(_ref, _ref2) {
    let {
      url,
      iterations = 10
    } = _ref;
    let {
      feed,
      setState
    } = _ref2;
    let data;
    let byteCount = 0;
    return {
      async init() {
        const recording = await parse$2(await fetch(url));
        const {
          cols,
          rows,
          events
        } = recording;
        data = Array.from(events).filter(_ref3 => {
          let [_time, type, _text] = _ref3;
          return type === "o";
        }).map(_ref4 => {
          let [time, _type, text] = _ref4;
          return [time, text];
        });
        const duration = data[data.length - 1][0];
        for (const [_, text] of data) {
          byteCount += new Blob([text]).size;
        }
        return {
          cols,
          rows,
          duration
        };
      },
      play() {
        const startTime = performance.now();
        for (let i = 0; i < iterations; i++) {
          for (const [_, text] of data) {
            feed(text);
          }
          feed("\x1bc"); // reset terminal
        }

        const endTime = performance.now();
        const duration = (endTime - startTime) / 1000;
        const throughput = byteCount * iterations / duration;
        const throughputMbs = byteCount / (1024 * 1024) * iterations / duration;
        console.info("benchmark: result", {
          byteCount,
          iterations,
          duration,
          throughput,
          throughputMbs
        });
        setTimeout(() => {
          setState("stopped", {
            reason: "ended"
          });
        }, 0);
        return true;
      }
    };
  }

  class Queue {
    constructor() {
      this.items = [];
      this.onPush = undefined;
    }
    push(item) {
      this.items.push(item);
      if (this.onPush !== undefined) {
        this.onPush(this.popAll());
        this.onPush = undefined;
      }
    }
    popAll() {
      if (this.items.length > 0) {
        const items = this.items;
        this.items = [];
        return items;
      } else {
        const thiz = this;
        return new Promise(resolve => {
          thiz.onPush = resolve;
        });
      }
    }
  }

  function getBuffer(bufferTime, feed, resize, onInput, onMarker, setTime, baseStreamTime, minFrameTime, logger) {
    const execute = executeEvent(feed, resize, onInput, onMarker);
    if (bufferTime === 0) {
      logger.debug("using no buffer");
      return nullBuffer(execute);
    } else {
      bufferTime = bufferTime ?? {};
      let getBufferTime;
      if (typeof bufferTime === "number") {
        logger.debug(`using fixed time buffer (${bufferTime} ms)`);
        getBufferTime = _latency => bufferTime;
      } else if (typeof bufferTime === "function") {
        logger.debug("using custom dynamic buffer");
        getBufferTime = bufferTime({
          logger
        });
      } else {
        logger.debug("using adaptive buffer", bufferTime);
        getBufferTime = adaptiveBufferTimeProvider({
          logger
        }, bufferTime);
      }
      return buffer(getBufferTime, execute, setTime, logger, baseStreamTime ?? 0.0, minFrameTime);
    }
  }
  function nullBuffer(execute) {
    return {
      pushEvent(event) {
        execute(event[1], event[2]);
      },
      pushText(text) {
        execute("o", text);
      },
      stop() {}
    };
  }
  function executeEvent(feed, resize, onInput, onMarker) {
    return function (code, data) {
      if (code === "o") {
        feed(data);
      } else if (code === "i") {
        onInput(data);
      } else if (code === "r") {
        resize(data.cols, data.rows);
      } else if (code === "m") {
        onMarker(data);
      }
    };
  }
  function buffer(getBufferTime, execute, setTime, logger, baseStreamTime) {
    let minFrameTime = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : 1.0 / 60;
    let epoch = performance.now() - baseStreamTime * 1000;
    let bufferTime = getBufferTime(0);
    const queue = new Queue();
    minFrameTime *= 1000;
    let prevElapsedStreamTime = -minFrameTime;
    let stop = false;
    function elapsedWallTime() {
      return performance.now() - epoch;
    }
    setTimeout(async () => {
      while (!stop) {
        const events = await queue.popAll();
        if (stop) return;
        for (const event of events) {
          const elapsedStreamTime = event[0] * 1000 + bufferTime;
          if (elapsedStreamTime - prevElapsedStreamTime < minFrameTime) {
            execute(event[1], event[2]);
            continue;
          }
          const delay = elapsedStreamTime - elapsedWallTime();
          if (delay > 0) {
            await sleep(delay);
            if (stop) return;
          }
          setTime(event[0]);
          execute(event[1], event[2]);
          prevElapsedStreamTime = elapsedStreamTime;
        }
      }
    }, 0);
    return {
      pushEvent(event) {
        let latency = elapsedWallTime() - event[0] * 1000;
        if (latency < 0) {
          logger.debug(`correcting epoch by ${latency} ms`);
          epoch += latency;
          latency = 0;
        }
        bufferTime = getBufferTime(latency);
        queue.push(event);
      },
      pushText(text) {
        queue.push([elapsedWallTime() / 1000, "o", text]);
      },
      stop() {
        stop = true;
        queue.push(undefined);
      }
    };
  }
  function sleep(t) {
    return new Promise(resolve => {
      setTimeout(resolve, t);
    });
  }
  function adaptiveBufferTimeProvider() {
    let {
      logger
    } = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    let {
      minBufferTime = 50,
      bufferLevelStep = 100,
      maxBufferLevel = 50,
      transitionDuration = 500,
      peakHalfLifeUp = 100,
      peakHalfLifeDown = 10000,
      floorHalfLifeUp = 5000,
      floorHalfLifeDown = 100,
      idealHalfLifeUp = 1000,
      idealHalfLifeDown = 5000,
      safetyMultiplier = 1.2,
      minImprovementDuration = 3000
    } = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    function levelToMs(level) {
      return level === 0 ? minBufferTime : bufferLevelStep * level;
    }
    let bufferLevel = 1;
    let bufferTime = levelToMs(bufferLevel);
    let lastUpdateTime = performance.now();
    let smoothedPeakLatency = null;
    let smoothedFloorLatency = null;
    let smoothedIdealBufferTime = null;
    let stableSince = null;
    let targetBufferTime = null;
    let transitionRate = null;
    return function (latency) {
      const now = performance.now();
      const dt = Math.max(0, now - lastUpdateTime);
      lastUpdateTime = now;

      // adjust EMA-smoothed peak latency from current latency

      if (smoothedPeakLatency === null) {
        smoothedPeakLatency = latency;
      } else if (latency > smoothedPeakLatency) {
        const alphaUp = 1 - Math.pow(2, -dt / peakHalfLifeUp);
        smoothedPeakLatency += alphaUp * (latency - smoothedPeakLatency);
      } else {
        const alphaDown = 1 - Math.pow(2, -dt / peakHalfLifeDown);
        smoothedPeakLatency += alphaDown * (latency - smoothedPeakLatency);
      }
      smoothedPeakLatency = Math.max(smoothedPeakLatency, 0);

      // adjust EMA-smoothed floor latency from current latency

      if (smoothedFloorLatency === null) {
        smoothedFloorLatency = latency;
      } else if (latency > smoothedFloorLatency) {
        const alphaUp = 1 - Math.pow(2, -dt / floorHalfLifeUp);
        smoothedFloorLatency += alphaUp * (latency - smoothedFloorLatency);
      } else {
        const alphaDown = 1 - Math.pow(2, -dt / floorHalfLifeDown);
        smoothedFloorLatency += alphaDown * (latency - smoothedFloorLatency);
      }
      smoothedFloorLatency = Math.max(smoothedFloorLatency, 0);

      // adjust EMA-smoothed ideal buffer time

      const jitter = smoothedPeakLatency - smoothedFloorLatency;
      const idealBufferTime = safetyMultiplier * (smoothedPeakLatency + jitter);
      if (smoothedIdealBufferTime === null) {
        smoothedIdealBufferTime = idealBufferTime;
      } else if (idealBufferTime > smoothedIdealBufferTime) {
        const alphaUp = 1 - Math.pow(2, -dt / idealHalfLifeUp);
        smoothedIdealBufferTime += +alphaUp * (idealBufferTime - smoothedIdealBufferTime);
      } else {
        const alphaDown = 1 - Math.pow(2, -dt / idealHalfLifeDown);
        smoothedIdealBufferTime += +alphaDown * (idealBufferTime - smoothedIdealBufferTime);
      }

      // quantize smoothed ideal buffer time to discrete buffer level

      let newBufferLevel;
      if (smoothedIdealBufferTime <= minBufferTime) {
        newBufferLevel = 0;
      } else {
        newBufferLevel = clamp(Math.ceil(smoothedIdealBufferTime / bufferLevelStep), 1, maxBufferLevel);
      }
      if (latency > bufferTime) {
        logger.debug('buffer underrun', {
          latency,
          bufferTime
        });
      }

      // adjust buffer level and target buffer time for new buffer level

      if (newBufferLevel > bufferLevel) {
        if (latency > bufferTime) {
          // <- underrun - raise quickly
          bufferLevel = Math.min(newBufferLevel, bufferLevel + 3);
        } else {
          bufferLevel += 1;
        }
        targetBufferTime = levelToMs(bufferLevel);
        transitionRate = (targetBufferTime - bufferTime) / transitionDuration;
        stableSince = null;
        logger.debug('raising buffer', {
          latency,
          bufferTime,
          targetBufferTime
        });
      } else if (newBufferLevel < bufferLevel) {
        if (stableSince == null) stableSince = now;
        if (now - stableSince >= minImprovementDuration) {
          bufferLevel -= 1;
          targetBufferTime = levelToMs(bufferLevel);
          transitionRate = (targetBufferTime - bufferTime) / transitionDuration;
          stableSince = now;
          logger.debug('lowering buffer', {
            latency,
            bufferTime,
            targetBufferTime
          });
        }
      } else {
        stableSince = null;
      }

      // linear transition to target buffer time

      if (targetBufferTime !== null) {
        bufferTime += transitionRate * dt;
        if (transitionRate >= 0 && bufferTime > targetBufferTime || transitionRate < 0 && bufferTime < targetBufferTime) {
          bufferTime = targetBufferTime;
          targetBufferTime = null;
        }
      }
      return bufferTime;
    };
  }
  function clamp(x, lo, hi) {
    return Math.min(hi, Math.max(lo, x));
  }

  const ONE_SEC_IN_USEC = 1000000;
  function alisHandler(logger) {
    const outputDecoder = new TextDecoder();
    const inputDecoder = new TextDecoder();
    let handler = parseMagicString;
    let lastEventTime;
    let markerIndex = 0;
    function parseMagicString(buffer) {
      const text = new TextDecoder().decode(buffer);
      if (text === "ALiS\x01") {
        handler = parseFirstFrame;
      } else {
        throw "not an ALiS v1 live stream";
      }
    }
    function parseFirstFrame(buffer) {
      const view = new BinaryReader(new DataView(buffer));
      const type = view.getUint8();
      if (type !== 0x01) throw `expected reset (0x01) frame, got ${type}`;
      return parseResetFrame(view, buffer);
    }
    function parseResetFrame(view, buffer) {
      view.decodeVarUint();
      let time = view.decodeVarUint();
      lastEventTime = time;
      time = time / ONE_SEC_IN_USEC;
      markerIndex = 0;
      const cols = view.decodeVarUint();
      const rows = view.decodeVarUint();
      const themeFormat = view.getUint8();
      let theme;
      if (themeFormat === 8) {
        const len = (2 + 8) * 3;
        theme = parseTheme(new Uint8Array(buffer, view.offset, len));
        view.forward(len);
      } else if (themeFormat === 16) {
        const len = (2 + 16) * 3;
        theme = parseTheme(new Uint8Array(buffer, view.offset, len));
        view.forward(len);
      } else if (themeFormat !== 0) {
        throw `alis: invalid theme format (${themeFormat})`;
      }
      const initLen = view.decodeVarUint();
      let init;
      if (initLen > 0) {
        init = outputDecoder.decode(new Uint8Array(buffer, view.offset, initLen));
      }
      handler = parseFrame;
      return {
        time,
        term: {
          size: {
            cols,
            rows
          },
          theme,
          init
        }
      };
    }
    function parseFrame(buffer) {
      const view = new BinaryReader(new DataView(buffer));
      const type = view.getUint8();
      if (type === 0x01) {
        return parseResetFrame(view, buffer);
      } else if (type === 0x6f) {
        return parseOutputFrame(view, buffer);
      } else if (type === 0x69) {
        return parseInputFrame(view, buffer);
      } else if (type === 0x72) {
        return parseResizeFrame(view);
      } else if (type === 0x6d) {
        return parseMarkerFrame(view, buffer);
      } else if (type === 0x04) {
        // EOT
        handler = parseFirstFrame;
        return false;
      } else {
        logger.debug(`alis: unknown frame type: ${type}`);
      }
    }
    function parseOutputFrame(view, buffer) {
      view.decodeVarUint();
      const relTime = view.decodeVarUint();
      lastEventTime += relTime;
      const len = view.decodeVarUint();
      const text = outputDecoder.decode(new Uint8Array(buffer, view.offset, len));
      return [lastEventTime / ONE_SEC_IN_USEC, "o", text];
    }
    function parseInputFrame(view, buffer) {
      view.decodeVarUint();
      const relTime = view.decodeVarUint();
      lastEventTime += relTime;
      const len = view.decodeVarUint();
      const text = inputDecoder.decode(new Uint8Array(buffer, view.offset, len));
      return [lastEventTime / ONE_SEC_IN_USEC, "i", text];
    }
    function parseResizeFrame(view) {
      view.decodeVarUint();
      const relTime = view.decodeVarUint();
      lastEventTime += relTime;
      const cols = view.decodeVarUint();
      const rows = view.decodeVarUint();
      return [lastEventTime / ONE_SEC_IN_USEC, "r", {
        cols,
        rows
      }];
    }
    function parseMarkerFrame(view, buffer) {
      view.decodeVarUint();
      const relTime = view.decodeVarUint();
      lastEventTime += relTime;
      const len = view.decodeVarUint();
      const decoder = new TextDecoder();
      const index = markerIndex++;
      const time = lastEventTime / ONE_SEC_IN_USEC;
      const label = decoder.decode(new Uint8Array(buffer, view.offset, len));
      return [time, "m", {
        index,
        time,
        label
      }];
    }
    return function (buffer) {
      return handler(buffer);
    };
  }
  function parseTheme(arr) {
    const colorCount = arr.length / 3;
    const foreground = hexColor(arr[0], arr[1], arr[2]);
    const background = hexColor(arr[3], arr[4], arr[5]);
    const palette = [];
    for (let i = 2; i < colorCount; i++) {
      palette.push(hexColor(arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]));
    }
    return {
      foreground,
      background,
      palette
    };
  }
  function hexColor(r, g, b) {
    return `#${byteToHex(r)}${byteToHex(g)}${byteToHex(b)}`;
  }
  function byteToHex(value) {
    return value.toString(16).padStart(2, "0");
  }
  class BinaryReader {
    constructor(inner) {
      let offset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
      this.inner = inner;
      this.offset = offset;
    }
    forward(delta) {
      this.offset += delta;
    }
    getUint8() {
      const value = this.inner.getUint8(this.offset);
      this.offset += 1;
      return value;
    }
    decodeVarUint() {
      let number = BigInt(0);
      let shift = BigInt(0);
      let byte = this.getUint8();
      while (byte > 127) {
        byte &= 127;
        number += BigInt(byte) << shift;
        shift += BigInt(7);
        byte = this.getUint8();
      }
      number = number + (BigInt(byte) << shift);
      return Number(number);
    }
  }

  function ascicastV2Handler() {
    let parse = parseHeader;
    function parseHeader(buffer) {
      const header = JSON.parse(buffer);
      if (header.version !== 2) {
        throw "not an asciicast v2 stream";
      }
      parse = parseEvent;
      return {
        time: 0.0,
        term: {
          size: {
            cols: header.width,
            rows: header.height
          }
        }
      };
    }
    function parseEvent(buffer) {
      const event = JSON.parse(buffer);
      if (event[1] === "r") {
        const [cols, rows] = event[2].split("x");
        return [event[0], "r", {
          cols: parseInt(cols, 10),
          rows: parseInt(rows, 10)
        }];
      } else {
        return event;
      }
    }
    return function (buffer) {
      return parse(buffer);
    };
  }

  function ascicastV3Handler() {
    let parse = parseHeader;
    let currentTime = 0;
    function parseHeader(buffer) {
      const header = JSON.parse(buffer);
      if (header.version !== 3) {
        throw "not an asciicast v3 stream";
      }
      parse = parseEvent;
      const term = {
        size: {
          cols: header.term.cols,
          rows: header.term.rows
        }
      };
      if (header.term.theme) {
        term.theme = {
          foreground: header.term.theme.fg,
          background: header.term.theme.bg,
          palette: header.term.theme.palette.split(":")
        };
      }
      return {
        time: 0.0,
        term
      };
    }
    function parseEvent(buffer) {
      const event = JSON.parse(buffer);
      const [interval, eventType, data] = event;
      currentTime += interval;
      if (eventType === "r") {
        const [cols, rows] = data.split("x");
        return [currentTime, "r", {
          cols: parseInt(cols, 10),
          rows: parseInt(rows, 10)
        }];
      } else {
        return [currentTime, eventType, data];
      }
    }
    return function (buffer) {
      return parse(buffer);
    };
  }

  function rawHandler() {
    const outputDecoder = new TextDecoder();
    let parse = parseSize;
    function parseSize(buffer) {
      const text = outputDecoder.decode(buffer, {
        stream: true
      });
      const [cols, rows] = sizeFromResizeSeq(text) ?? sizeFromScriptStartMessage(text) ?? [80, 24];
      parse = parseOutput;
      return {
        time: 0.0,
        term: {
          size: {
            cols,
            rows
          },
          init: text
        }
      };
    }
    function parseOutput(buffer) {
      return outputDecoder.decode(buffer, {
        stream: true
      });
    }
    return function (buffer) {
      return parse(buffer);
    };
  }
  function sizeFromResizeSeq(text) {
    const match = text.match(/\x1b\[8;(\d+);(\d+)t/);
    if (match !== null) {
      return [parseInt(match[2], 10), parseInt(match[1], 10)];
    }
  }
  function sizeFromScriptStartMessage(text) {
    const match = text.match(/\[.*COLUMNS="(\d{1,3})" LINES="(\d{1,3})".*\]/);
    if (match !== null) {
      return [parseInt(match[1], 10), parseInt(match[2], 10)];
    }
  }

  const RECONNECT_DELAY_BASE = 500;
  const RECONNECT_DELAY_CAP = 10000;
  function exponentialDelay(attempt) {
    const base = Math.min(RECONNECT_DELAY_BASE * Math.pow(2, attempt), RECONNECT_DELAY_CAP);
    return Math.random() * base;
  }
  function websocket(_ref, _ref2, _ref3) {
    let {
      url,
      bufferTime,
      reconnectDelay = exponentialDelay,
      minFrameTime
    } = _ref;
    let {
      feed,
      reset,
      resize,
      onInput,
      onMarker,
      setState,
      logger
    } = _ref2;
    let {
      audioUrl
    } = _ref3;
    logger = new PrefixedLogger(logger, "websocket: ");
    let socket;
    let buf;
    let clock = new NullClock();
    let reconnectAttempt = 0;
    let successfulConnectionTimeout;
    let stop = false;
    let wasOnline = false;
    let initTimeout;
    let audioElement;
    function connect() {
      socket = new WebSocket(url, ["v1.alis", "v2.asciicast", "v3.asciicast", "raw"]);
      socket.binaryType = "arraybuffer";
      socket.onopen = () => {
        const proto = socket.protocol || "raw";
        logger.info("opened");
        logger.info(`activating ${proto} protocol handler`);
        if (proto === "v1.alis") {
          socket.onmessage = onMessage(alisHandler(logger));
        } else if (proto === "v2.asciicast") {
          socket.onmessage = onMessage(ascicastV2Handler());
        } else if (proto === "v3.asciicast") {
          socket.onmessage = onMessage(ascicastV3Handler());
        } else if (proto === "raw") {
          socket.onmessage = onMessage(rawHandler());
        }
        successfulConnectionTimeout = setTimeout(() => {
          reconnectAttempt = 0;
        }, 1000);
      };
      socket.onclose = event => {
        clearTimeout(initTimeout);
        stopBuffer();
        if (stop || event.code === 1000 || event.code === 1005) {
          logger.info("closed");
          setState("ended", {
            message: "Stream ended"
          });
        } else if (event.code === 1002) {
          logger.debug(`close reason: ${event.reason}`);
          setState("ended", {
            message: "Err: Player not compatible with the server"
          });
        } else {
          clearTimeout(successfulConnectionTimeout);
          const delay = reconnectDelay(reconnectAttempt++);
          logger.info(`unclean close, reconnecting in ${delay}...`);
          setState("loading");
          setTimeout(connect, delay);
        }
      };
      wasOnline = false;
    }
    function onMessage(handler) {
      initTimeout = setTimeout(onStreamEnd, 5000);
      return function (event) {
        try {
          const result = handler(event.data);
          if (buf) {
            if (Array.isArray(result)) {
              buf.pushEvent(result);
            } else if (typeof result === "string") {
              buf.pushText(result);
            } else if (typeof result === "object" && !Array.isArray(result)) {
              // TODO: check last event ID from the parser, don't reset if we didn't miss anything
              onStreamReset(result);
            } else if (result === false) {
              // EOT
              onStreamEnd();
            } else if (result !== undefined) {
              throw `unexpected value from protocol handler: ${result}`;
            }
          } else {
            if (typeof result === "object" && !Array.isArray(result)) {
              onStreamReset(result);
              clearTimeout(initTimeout);
            } else if (result === undefined) {
              clearTimeout(initTimeout);
              initTimeout = setTimeout(onStreamEnd, 1000);
            } else {
              clearTimeout(initTimeout);
              throw `unexpected value from protocol handler: ${result}`;
            }
          }
        } catch (e) {
          socket.close();
          throw e;
        }
      };
    }
    function onStreamReset(_ref4) {
      let {
        time,
        term
      } = _ref4;
      const {
        size,
        init,
        theme
      } = term;
      const {
        cols,
        rows
      } = size;
      logger.info(`stream reset (${cols}x${rows} @${time})`);
      setState("playing");
      stopBuffer();
      buf = getBuffer(bufferTime, feed, resize, onInput, onMarker, t => clock.setTime(t), time, minFrameTime, logger);
      reset(cols, rows, init, theme);
      clock = new Clock();
      wasOnline = true;
      if (typeof time === "number") {
        clock.setTime(time);
      }
    }
    function onStreamEnd() {
      stopBuffer();
      if (wasOnline) {
        logger.info("stream ended");
        setState("offline", {
          message: "Stream ended"
        });
      } else {
        logger.info("stream offline");
        setState("offline", {
          message: "Stream offline"
        });
      }
      clock = new NullClock();
    }
    function stopBuffer() {
      if (buf) buf.stop();
      buf = null;
    }
    function startAudio() {
      if (!audioUrl) return;
      audioElement = new Audio();
      audioElement.preload = "auto";
      audioElement.crossOrigin = "anonymous";
      audioElement.src = audioUrl;
      audioElement.play();
    }
    function stopAudio() {
      if (!audioElement) return;
      audioElement.pause();
    }
    function mute() {
      if (audioElement) {
        audioElement.muted = true;
        return true;
      }
    }
    function unmute() {
      if (audioElement) {
        audioElement.muted = false;
        return true;
      }
    }
    return {
      init: () => {
        return {
          hasAudio: !!audioUrl
        };
      },
      play: () => {
        connect();
        startAudio();
      },
      stop: () => {
        stop = true;
        stopBuffer();
        if (socket !== undefined) socket.close();
        stopAudio();
      },
      mute,
      unmute,
      getCurrentTime: () => clock.getTime()
    };
  }

  function eventsource(_ref, _ref2) {
    let {
      url,
      bufferTime,
      minFrameTime
    } = _ref;
    let {
      feed,
      reset,
      resize,
      onInput,
      onMarker,
      setState,
      logger
    } = _ref2;
    logger = new PrefixedLogger(logger, "eventsource: ");
    let es;
    let buf;
    let clock = new NullClock();
    function initBuffer(baseStreamTime) {
      if (buf !== undefined) buf.stop();
      buf = getBuffer(bufferTime, feed, resize, onInput, onMarker, t => clock.setTime(t), baseStreamTime, minFrameTime, logger);
    }
    return {
      play: () => {
        es = new EventSource(url);
        es.addEventListener("open", () => {
          logger.info("opened");
          initBuffer();
        });
        es.addEventListener("error", e => {
          logger.info("errored");
          logger.debug({
            e
          });
          setState("loading");
        });
        es.addEventListener("message", event => {
          const e = JSON.parse(event.data);
          if (Array.isArray(e)) {
            buf.pushEvent(e);
          } else if (e.cols !== undefined || e.width !== undefined) {
            const cols = e.cols ?? e.width;
            const rows = e.rows ?? e.height;
            logger.debug(`vt reset (${cols}x${rows})`);
            setState("playing");
            initBuffer(e.time);
            reset(cols, rows, e.init ?? undefined);
            clock = new Clock();
            if (typeof e.time === "number") {
              clock.setTime(e.time);
            }
          } else if (e.state === "offline") {
            logger.info("stream offline");
            setState("offline", {
              message: "Stream offline"
            });
            clock = new NullClock();
          }
        });
        es.addEventListener("done", () => {
          logger.info("closed");
          es.close();
          setState("ended", {
            message: "Stream ended"
          });
        });
      },
      stop: () => {
        if (buf !== undefined) buf.stop();
        if (es !== undefined) es.close();
      },
      getCurrentTime: () => clock.getTime()
    };
  }

  async function parse$1(responses, _ref) {
    let {
      encoding
    } = _ref;
    const textDecoder = new TextDecoder(encoding);
    let cols;
    let rows;
    let timing = (await responses[0].text()).split("\n").filter(line => line.length > 0).map(line => line.split(" "));
    if (timing[0].length < 3) {
      timing = timing.map(entry => ["O", entry[0], entry[1]]);
    }
    const buffer = await responses[1].arrayBuffer();
    const array = new Uint8Array(buffer);
    const dataOffset = array.findIndex(byte => byte == 0x0a) + 1;
    const header = textDecoder.decode(array.subarray(0, dataOffset));
    const sizeMatch = header.match(/COLUMNS="(\d+)" LINES="(\d+)"/);
    if (sizeMatch !== null) {
      cols = parseInt(sizeMatch[1], 10);
      rows = parseInt(sizeMatch[2], 10);
    }
    const stdout = {
      array,
      cursor: dataOffset
    };
    let stdin = stdout;
    if (responses[2] !== undefined) {
      const buffer = await responses[2].arrayBuffer();
      const array = new Uint8Array(buffer);
      stdin = {
        array,
        cursor: dataOffset
      };
    }
    const events = [];
    let time = 0;
    for (const entry of timing) {
      time += parseFloat(entry[1]);
      if (entry[0] === "O") {
        const count = parseInt(entry[2], 10);
        const bytes = stdout.array.subarray(stdout.cursor, stdout.cursor + count);
        const text = textDecoder.decode(bytes);
        events.push([time, "o", text]);
        stdout.cursor += count;
      } else if (entry[0] === "I") {
        const count = parseInt(entry[2], 10);
        const bytes = stdin.array.subarray(stdin.cursor, stdin.cursor + count);
        const text = textDecoder.decode(bytes);
        events.push([time, "i", text]);
        stdin.cursor += count;
      } else if (entry[0] === "S" && entry[2] === "SIGWINCH") {
        const cols = parseInt(entry[4].slice(5), 10);
        const rows = parseInt(entry[3].slice(5), 10);
        events.push([time, "r", `${cols}x${rows}`]);
      } else if (entry[0] === "H" && entry[2] === "COLUMNS") {
        cols = parseInt(entry[3], 10);
      } else if (entry[0] === "H" && entry[2] === "LINES") {
        rows = parseInt(entry[3], 10);
      }
    }
    cols = cols ?? 80;
    rows = rows ?? 24;
    return {
      cols,
      rows,
      events
    };
  }

  async function parse(response, _ref) {
    let {
      encoding
    } = _ref;
    const textDecoder = new TextDecoder(encoding);
    const buffer = await response.arrayBuffer();
    const array = new Uint8Array(buffer);
    const firstFrame = parseFrame(array);
    const baseTime = firstFrame.time;
    const firstFrameText = textDecoder.decode(firstFrame.data);
    const sizeMatch = firstFrameText.match(/\x1b\[8;(\d+);(\d+)t/);
    const events = [];
    let cols = 80;
    let rows = 24;
    if (sizeMatch !== null) {
      cols = parseInt(sizeMatch[2], 10);
      rows = parseInt(sizeMatch[1], 10);
    }
    let cursor = 0;
    let frame = parseFrame(array);
    while (frame !== undefined) {
      const time = frame.time - baseTime;
      const text = textDecoder.decode(frame.data);
      events.push([time, "o", text]);
      cursor += frame.len;
      frame = parseFrame(array.subarray(cursor));
    }
    return {
      cols,
      rows,
      events
    };
  }
  function parseFrame(array) {
    if (array.length < 13) return;
    const time = parseTimestamp(array.subarray(0, 8));
    const len = parseNumber(array.subarray(8, 12));
    const data = array.subarray(12, 12 + len);
    return {
      time,
      data,
      len: len + 12
    };
  }
  function parseNumber(array) {
    return array[0] + array[1] * 256 + array[2] * 256 * 256 + array[3] * 256 * 256 * 256;
  }
  function parseTimestamp(array) {
    const sec = parseNumber(array.subarray(0, 4));
    const usec = parseNumber(array.subarray(4, 8));
    return sec + usec / 1000000;
  }

  const vt = loadVt(); // trigger async loading of wasm

  class State {
    constructor(core) {
      this.core = core;
      this.driver = core.driver;
    }
    onEnter(data) {}
    init() {}
    play() {}
    pause() {}
    togglePlay() {}
    mute() {
      if (this.driver && this.driver.mute()) {
        this.core._dispatchEvent("muted", true);
      }
    }
    unmute() {
      if (this.driver && this.driver.unmute()) {
        this.core._dispatchEvent("muted", false);
      }
    }
    seek(where) {
      return false;
    }
    step(n) {}
    stop() {
      this.driver.stop();
    }
  }
  class UninitializedState extends State {
    async init() {
      try {
        await this.core._initializeDriver();
        return this.core._setState("idle");
      } catch (e) {
        this.core._setState("errored");
        throw e;
      }
    }
    async play() {
      this.core._dispatchEvent("play");
      const idleState = await this.init();
      await idleState.doPlay();
    }
    async togglePlay() {
      await this.play();
    }
    async seek(where) {
      const idleState = await this.init();
      return await idleState.seek(where);
    }
    async step(n) {
      const idleState = await this.init();
      await idleState.step(n);
    }
    stop() {}
  }
  class Idle extends State {
    onEnter(_ref) {
      let {
        reason,
        message
      } = _ref;
      this.core._dispatchEvent("idle", {
        message
      });
      if (reason === "paused") {
        this.core._dispatchEvent("pause");
      }
    }
    async play() {
      this.core._dispatchEvent("play");
      await this.doPlay();
    }
    async doPlay() {
      const stop = await this.driver.play();
      if (stop === true) {
        this.core._setState("playing");
      } else if (typeof stop === "function") {
        this.core._setState("playing");
        this.driver.stop = stop;
      }
    }
    async togglePlay() {
      await this.play();
    }
    seek(where) {
      return this.driver.seek(where);
    }
    step(n) {
      this.driver.step(n);
    }
  }
  class PlayingState extends State {
    onEnter() {
      this.core._dispatchEvent("playing");
    }
    pause() {
      if (this.driver.pause() === true) {
        this.core._setState("idle", {
          reason: "paused"
        });
      }
    }
    togglePlay() {
      this.pause();
    }
    seek(where) {
      return this.driver.seek(where);
    }
  }
  class LoadingState extends State {
    onEnter() {
      this.core._dispatchEvent("loading");
    }
  }
  class OfflineState extends State {
    onEnter(_ref2) {
      let {
        message
      } = _ref2;
      this.core._dispatchEvent("offline", {
        message
      });
    }
  }
  class EndedState extends State {
    onEnter(_ref3) {
      let {
        message
      } = _ref3;
      this.core._dispatchEvent("ended", {
        message
      });
    }
    async play() {
      this.core._dispatchEvent("play");
      if (await this.driver.restart()) {
        this.core._setState('playing');
      }
    }
    async togglePlay() {
      await this.play();
    }
    async seek(where) {
      if ((await this.driver.seek(where)) === true) {
        this.core._setState('idle');
        return true;
      }
      return false;
    }
  }
  class ErroredState extends State {
    onEnter() {
      this.core._dispatchEvent("errored");
    }
  }
  class Core {
    constructor(src, opts) {
      this.logger = opts.logger;
      this.state = new UninitializedState(this);
      this.stateName = "uninitialized";
      this.driver = getDriver(src);
      this.changedLines = new Set();
      this.cursor = undefined;
      this.duration = undefined;
      this.cols = opts.cols;
      this.rows = opts.rows;
      this.speed = opts.speed;
      this.loop = opts.loop;
      this.autoPlay = opts.autoPlay;
      this.idleTimeLimit = opts.idleTimeLimit;
      this.preload = opts.preload;
      this.startAt = parseNpt(opts.startAt);
      this.poster = this._parsePoster(opts.poster);
      this.markers = this._normalizeMarkers(opts.markers);
      this.pauseOnMarkers = opts.pauseOnMarkers;
      this.audioUrl = opts.audioUrl;
      this.commandQueue = Promise.resolve();
      this.eventHandlers = new Map([["ended", []], ["errored", []], ["idle", []], ["input", []], ["loading", []], ["marker", []], ["metadata", []], ["muted", []], ["offline", []], ["pause", []], ["play", []], ["playing", []], ["ready", []], ["reset", []], ["resize", []], ["seeked", []], ["terminalUpdate", []]]);
    }
    async init() {
      this.wasm = await vt;
      const feed = this._feed.bind(this);
      const onInput = data => {
        this._dispatchEvent("input", {
          data
        });
      };
      const onMarker = _ref4 => {
        let {
          index,
          time,
          label
        } = _ref4;
        this._dispatchEvent("marker", {
          index,
          time,
          label
        });
      };
      const reset = this._resetVt.bind(this);
      const resize = this._resizeVt.bind(this);
      const setState = this._setState.bind(this);
      const posterTime = this.poster.type === "npt" ? this.poster.value : undefined;
      this.driver = this.driver({
        feed,
        onInput,
        onMarker,
        reset,
        resize,
        setState,
        logger: this.logger
      }, {
        cols: this.cols,
        rows: this.rows,
        speed: this.speed,
        idleTimeLimit: this.idleTimeLimit,
        startAt: this.startAt,
        loop: this.loop,
        posterTime: posterTime,
        markers: this.markers,
        pauseOnMarkers: this.pauseOnMarkers,
        audioUrl: this.audioUrl
      });
      if (typeof this.driver === "function") {
        this.driver = {
          play: this.driver
        };
      }
      if (this.preload || posterTime !== undefined) {
        this._withState(state => state.init());
      }
      const poster = this.poster.type === "text" ? this._renderPoster(this.poster.value) : null;
      const config = {
        isPausable: !!this.driver.pause,
        isSeekable: !!this.driver.seek,
        poster
      };
      if (this.driver.init === undefined) {
        this.driver.init = () => {
          return {};
        };
      }
      if (this.driver.pause === undefined) {
        this.driver.pause = () => {};
      }
      if (this.driver.seek === undefined) {
        this.driver.seek = where => false;
      }
      if (this.driver.step === undefined) {
        this.driver.step = n => {};
      }
      if (this.driver.stop === undefined) {
        this.driver.stop = () => {};
      }
      if (this.driver.restart === undefined) {
        this.driver.restart = () => {};
      }
      if (this.driver.mute === undefined) {
        this.driver.mute = () => {};
      }
      if (this.driver.unmute === undefined) {
        this.driver.unmute = () => {};
      }
      if (this.driver.getCurrentTime === undefined) {
        const play = this.driver.play;
        let clock = new NullClock();
        this.driver.play = () => {
          clock = new Clock(this.speed);
          return play();
        };
        this.driver.getCurrentTime = () => clock.getTime();
      }
      this._dispatchEvent("ready", config);
      if (this.autoPlay) {
        this.play();
      }
    }
    play() {
      return this._withState(state => state.play());
    }
    pause() {
      return this._withState(state => state.pause());
    }
    togglePlay() {
      return this._withState(state => state.togglePlay());
    }
    seek(where) {
      return this._withState(async state => {
        if (await state.seek(where)) {
          this._dispatchEvent("seeked");
        }
      });
    }
    step(n) {
      return this._withState(state => state.step(n));
    }
    stop() {
      return this._withState(state => state.stop());
    }
    mute() {
      return this._withState(state => state.mute());
    }
    unmute() {
      return this._withState(state => state.unmute());
    }
    getChanges() {
      const changes = {};
      if (this.changedLines.size > 0) {
        const lines = new Map();
        const rows = this.vt.rows;
        for (const i of this.changedLines) {
          if (i < rows) {
            const line = this.vt.getLine(i);
            line.id = i;
            lines.set(i, line);
          }
        }
        this.changedLines.clear();
        changes.lines = lines;
      }
      if (this.cursor === undefined && this.vt) {
        this.cursor = this.vt.getCursor() ?? false;
        changes.cursor = this.cursor;
      }
      return changes;
    }
    getCurrentTime() {
      return this.driver.getCurrentTime();
    }
    getRemainingTime() {
      if (typeof this.duration === "number") {
        return this.duration - Math.min(this.getCurrentTime(), this.duration);
      }
    }
    getProgress() {
      if (typeof this.duration === "number") {
        return Math.min(this.getCurrentTime(), this.duration) / this.duration;
      }
    }
    getDuration() {
      return this.duration;
    }
    addEventListener(eventName, handler) {
      this.eventHandlers.get(eventName).push(handler);
    }
    _dispatchEvent(eventName) {
      let data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      for (const h of this.eventHandlers.get(eventName)) {
        h(data);
      }
    }
    _withState(f) {
      return this._enqueueCommand(() => f(this.state));
    }
    _enqueueCommand(f) {
      this.commandQueue = this.commandQueue.then(f);
      return this.commandQueue;
    }
    _setState(newState) {
      let data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      if (this.stateName === newState) return this.state;
      this.stateName = newState;
      if (newState === "playing") {
        this.state = new PlayingState(this);
      } else if (newState === "idle") {
        this.state = new Idle(this);
      } else if (newState === "loading") {
        this.state = new LoadingState(this);
      } else if (newState === "ended") {
        this.state = new EndedState(this);
      } else if (newState === "offline") {
        this.state = new OfflineState(this);
      } else if (newState === "errored") {
        this.state = new ErroredState(this);
      } else {
        throw `invalid state: ${newState}`;
      }
      this.state.onEnter(data);
      return this.state;
    }
    _feed(data) {
      this._doFeed(data);
      this._dispatchEvent("terminalUpdate");
    }
    _doFeed(data) {
      const affectedLines = this.vt.feed(data);
      affectedLines.forEach(i => this.changedLines.add(i));
      this.cursor = undefined;
    }
    async _initializeDriver() {
      const meta = await this.driver.init();
      this.cols = this.cols ?? meta.cols ?? 80;
      this.rows = this.rows ?? meta.rows ?? 24;
      this.duration = this.duration ?? meta.duration;
      this.markers = this._normalizeMarkers(meta.markers) ?? this.markers ?? [];
      if (this.cols === 0) {
        this.cols = 80;
      }
      if (this.rows === 0) {
        this.rows = 24;
      }
      this._initializeVt(this.cols, this.rows);
      const poster = meta.poster !== undefined ? this._renderPoster(meta.poster) : null;
      this._dispatchEvent("metadata", {
        cols: this.cols,
        rows: this.rows,
        duration: this.duration,
        markers: this.markers,
        theme: meta.theme,
        hasAudio: meta.hasAudio,
        poster
      });
    }
    _resetVt(cols, rows) {
      let init = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : undefined;
      let theme = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : undefined;
      this.logger.debug(`core: vt reset (${cols}x${rows})`);
      this.cols = cols;
      this.rows = rows;
      this.cursor = undefined;
      this._initializeVt(cols, rows);
      if (init !== undefined && init !== "") {
        this._doFeed(init);
      }
      this._dispatchEvent("reset", {
        cols,
        rows,
        theme
      });
    }
    _resizeVt(cols, rows) {
      if (cols === this.vt.cols && rows === this.vt.rows) return;
      const affectedLines = this.vt.resize(cols, rows);
      affectedLines.forEach(i => this.changedLines.add(i));
      this.cursor = undefined;
      this.vt.cols = cols;
      this.vt.rows = rows;
      this.logger.debug(`core: vt resize (${cols}x${rows})`);
      this._dispatchEvent("resize", {
        cols,
        rows
      });
    }
    _initializeVt(cols, rows) {
      this.vt = this.wasm.create(cols, rows, true, 100);
      this.vt.cols = cols;
      this.vt.rows = rows;
      this.changedLines.clear();
      for (let i = 0; i < rows; i++) {
        this.changedLines.add(i);
      }
    }
    _parsePoster(poster) {
      if (typeof poster !== "string") return {};
      if (poster.substring(0, 16) == "data:text/plain,") {
        return {
          type: "text",
          value: [poster.substring(16)]
        };
      } else if (poster.substring(0, 4) == "npt:") {
        return {
          type: "npt",
          value: parseNpt(poster.substring(4))
        };
      }
      return {};
    }
    _renderPoster(poster) {
      const cols = this.cols ?? 80;
      const rows = this.rows ?? 24;
      this.logger.debug(`core: poster init (${cols}x${rows})`);
      const vt = this.wasm.create(cols, rows, false, 0);
      poster.forEach(text => vt.feed(text));
      const cursor = vt.getCursor() ?? false;
      const lines = [];
      for (let i = 0; i < rows; i++) {
        const line = vt.getLine(i);
        line.id = i;
        lines.push(line);
      }
      return {
        cursor,
        lines
      };
    }
    _normalizeMarkers(markers) {
      if (Array.isArray(markers)) {
        return markers.map(m => typeof m === "number" ? [m, ""] : m);
      }
    }
  }
  const DRIVERS = new Map([["benchmark", benchmark], ["clock", clock], ["eventsource", eventsource], ["random", random], ["recording", recording], ["websocket", websocket]]);
  const PARSERS = new Map([["asciicast", parse$2], ["typescript", parse$1], ["ttyrec", parse]]);
  function getDriver(src) {
    if (typeof src === "function") return src;
    if (typeof src === "string") {
      if (src.substring(0, 5) == "ws://" || src.substring(0, 6) == "wss://") {
        src = {
          driver: "websocket",
          url: src
        };
      } else if (src.substring(0, 6) == "clock:") {
        src = {
          driver: "clock"
        };
      } else if (src.substring(0, 7) == "random:") {
        src = {
          driver: "random"
        };
      } else if (src.substring(0, 10) == "benchmark:") {
        src = {
          driver: "benchmark",
          url: src.substring(10)
        };
      } else {
        src = {
          driver: "recording",
          url: src
        };
      }
    }
    if (src.driver === undefined) {
      src.driver = "recording";
    }
    if (src.driver == "recording") {
      if (src.parser === undefined) {
        src.parser = "asciicast";
      }
      if (typeof src.parser === "string") {
        if (PARSERS.has(src.parser)) {
          src.parser = PARSERS.get(src.parser);
        } else {
          throw `unknown parser: ${src.parser}`;
        }
      }
    }
    if (DRIVERS.has(src.driver)) {
      const driver = DRIVERS.get(src.driver);
      return (callbacks, opts) => driver(src, callbacks, opts);
    } else {
      throw `unsupported driver: ${JSON.stringify(src)}`;
    }
  }

  const IS_DEV = false;
  const equalFn = (a, b) => a === b;
  const $PROXY = Symbol("solid-proxy");
  const SUPPORTS_PROXY = typeof Proxy === "function";
  const $TRACK = Symbol("solid-track");
  const signalOptions = {
    equals: equalFn
  };
  let runEffects = runQueue;
  const STALE = 1;
  const PENDING = 2;
  const UNOWNED = {
    owned: null,
    cleanups: null,
    context: null,
    owner: null
  };
  var Owner = null;
  let Transition$1 = null;
  let ExternalSourceConfig = null;
  let Listener = null;
  let Updates = null;
  let Effects = null;
  let ExecCount = 0;
  function createRoot(fn, detachedOwner) {
    const listener = Listener,
      owner = Owner,
      unowned = fn.length === 0,
      current = detachedOwner === undefined ? owner : detachedOwner,
      root = unowned
        ? UNOWNED
        : {
            owned: null,
            cleanups: null,
            context: current ? current.context : null,
            owner: current
          },
      updateFn = unowned ? fn : () => fn(() => untrack(() => cleanNode(root)));
    Owner = root;
    Listener = null;
    try {
      return runUpdates(updateFn, true);
    } finally {
      Listener = listener;
      Owner = owner;
    }
  }
  function createSignal(value, options) {
    options = options ? Object.assign({}, signalOptions, options) : signalOptions;
    const s = {
      value,
      observers: null,
      observerSlots: null,
      comparator: options.equals || undefined
    };
    const setter = value => {
      if (typeof value === "function") {
        value = value(s.value);
      }
      return writeSignal(s, value);
    };
    return [readSignal.bind(s), setter];
  }
  function createComputed(fn, value, options) {
    const c = createComputation(fn, value, true, STALE);
    updateComputation(c);
  }
  function createRenderEffect(fn, value, options) {
    const c = createComputation(fn, value, false, STALE);
    updateComputation(c);
  }
  function createEffect(fn, value, options) {
    runEffects = runUserEffects;
    const c = createComputation(fn, value, false, STALE);
    c.user = true;
    Effects ? Effects.push(c) : updateComputation(c);
  }
  function createMemo(fn, value, options) {
    options = options ? Object.assign({}, signalOptions, options) : signalOptions;
    const c = createComputation(fn, value, true, 0);
    c.observers = null;
    c.observerSlots = null;
    c.comparator = options.equals || undefined;
    updateComputation(c);
    return readSignal.bind(c);
  }
  function batch(fn) {
    return runUpdates(fn, false);
  }
  function untrack(fn) {
    if (Listener === null) return fn();
    const listener = Listener;
    Listener = null;
    try {
      if (ExternalSourceConfig) ;
      return fn();
    } finally {
      Listener = listener;
    }
  }
  function onMount(fn) {
    createEffect(() => untrack(fn));
  }
  function onCleanup(fn) {
    if (Owner === null);
    else if (Owner.cleanups === null) Owner.cleanups = [fn];
    else Owner.cleanups.push(fn);
    return fn;
  }
  function getListener() {
    return Listener;
  }
  function startTransition(fn) {
    const l = Listener;
    const o = Owner;
    return Promise.resolve().then(() => {
      Listener = l;
      Owner = o;
      let t;
      runUpdates(fn, false);
      Listener = Owner = null;
      return t ? t.done : undefined;
    });
  }
  const [transPending, setTransPending] = /*@__PURE__*/ createSignal(false);
  function useTransition() {
    return [transPending, startTransition];
  }
  function children(fn) {
    const children = createMemo(fn);
    const memo = createMemo(() => resolveChildren(children()));
    memo.toArray = () => {
      const c = memo();
      return Array.isArray(c) ? c : c != null ? [c] : [];
    };
    return memo;
  }
  function readSignal() {
    if (this.sources && (this.state)) {
      if ((this.state) === STALE) updateComputation(this);
      else {
        const updates = Updates;
        Updates = null;
        runUpdates(() => lookUpstream(this), false);
        Updates = updates;
      }
    }
    if (Listener) {
      const sSlot = this.observers ? this.observers.length : 0;
      if (!Listener.sources) {
        Listener.sources = [this];
        Listener.sourceSlots = [sSlot];
      } else {
        Listener.sources.push(this);
        Listener.sourceSlots.push(sSlot);
      }
      if (!this.observers) {
        this.observers = [Listener];
        this.observerSlots = [Listener.sources.length - 1];
      } else {
        this.observers.push(Listener);
        this.observerSlots.push(Listener.sources.length - 1);
      }
    }
    return this.value;
  }
  function writeSignal(node, value, isComp) {
    let current =
      node.value;
    if (!node.comparator || !node.comparator(current, value)) {
      node.value = value;
      if (node.observers && node.observers.length) {
        runUpdates(() => {
          for (let i = 0; i < node.observers.length; i += 1) {
            const o = node.observers[i];
            const TransitionRunning = Transition$1 && Transition$1.running;
            if (TransitionRunning && Transition$1.disposed.has(o)) ;
            if (TransitionRunning ? !o.tState : !o.state) {
              if (o.pure) Updates.push(o);
              else Effects.push(o);
              if (o.observers) markDownstream(o);
            }
            if (!TransitionRunning) o.state = STALE;
          }
          if (Updates.length > 10e5) {
            Updates = [];
            if (IS_DEV);
            throw new Error();
          }
        }, false);
      }
    }
    return value;
  }
  function updateComputation(node) {
    if (!node.fn) return;
    cleanNode(node);
    const time = ExecCount;
    runComputation(
      node,
      node.value,
      time
    );
  }
  function runComputation(node, value, time) {
    let nextValue;
    const owner = Owner,
      listener = Listener;
    Listener = Owner = node;
    try {
      nextValue = node.fn(value);
    } catch (err) {
      if (node.pure) {
        {
          node.state = STALE;
          node.owned && node.owned.forEach(cleanNode);
          node.owned = null;
        }
      }
      node.updatedAt = time + 1;
      return handleError(err);
    } finally {
      Listener = listener;
      Owner = owner;
    }
    if (!node.updatedAt || node.updatedAt <= time) {
      if (node.updatedAt != null && "observers" in node) {
        writeSignal(node, nextValue);
      } else node.value = nextValue;
      node.updatedAt = time;
    }
  }
  function createComputation(fn, init, pure, state = STALE, options) {
    const c = {
      fn,
      state: state,
      updatedAt: null,
      owned: null,
      sources: null,
      sourceSlots: null,
      cleanups: null,
      value: init,
      owner: Owner,
      context: Owner ? Owner.context : null,
      pure
    };
    if (Owner === null);
    else if (Owner !== UNOWNED) {
      {
        if (!Owner.owned) Owner.owned = [c];
        else Owner.owned.push(c);
      }
    }
    return c;
  }
  function runTop(node) {
    if ((node.state) === 0) return;
    if ((node.state) === PENDING) return lookUpstream(node);
    if (node.suspense && untrack(node.suspense.inFallback)) return node.suspense.effects.push(node);
    const ancestors = [node];
    while ((node = node.owner) && (!node.updatedAt || node.updatedAt < ExecCount)) {
      if (node.state) ancestors.push(node);
    }
    for (let i = ancestors.length - 1; i >= 0; i--) {
      node = ancestors[i];
      if ((node.state) === STALE) {
        updateComputation(node);
      } else if ((node.state) === PENDING) {
        const updates = Updates;
        Updates = null;
        runUpdates(() => lookUpstream(node, ancestors[0]), false);
        Updates = updates;
      }
    }
  }
  function runUpdates(fn, init) {
    if (Updates) return fn();
    let wait = false;
    if (!init) Updates = [];
    if (Effects) wait = true;
    else Effects = [];
    ExecCount++;
    try {
      const res = fn();
      completeUpdates(wait);
      return res;
    } catch (err) {
      if (!wait) Effects = null;
      Updates = null;
      handleError(err);
    }
  }
  function completeUpdates(wait) {
    if (Updates) {
      runQueue(Updates);
      Updates = null;
    }
    if (wait) return;
    const e = Effects;
    Effects = null;
    if (e.length) runUpdates(() => runEffects(e), false);
  }
  function runQueue(queue) {
    for (let i = 0; i < queue.length; i++) runTop(queue[i]);
  }
  function runUserEffects(queue) {
    let i,
      userLength = 0;
    for (i = 0; i < queue.length; i++) {
      const e = queue[i];
      if (!e.user) runTop(e);
      else queue[userLength++] = e;
    }
    for (i = 0; i < userLength; i++) runTop(queue[i]);
  }
  function lookUpstream(node, ignore) {
    node.state = 0;
    for (let i = 0; i < node.sources.length; i += 1) {
      const source = node.sources[i];
      if (source.sources) {
        const state = source.state;
        if (state === STALE) {
          if (source !== ignore && (!source.updatedAt || source.updatedAt < ExecCount))
            runTop(source);
        } else if (state === PENDING) lookUpstream(source, ignore);
      }
    }
  }
  function markDownstream(node) {
    for (let i = 0; i < node.observers.length; i += 1) {
      const o = node.observers[i];
      if (!o.state) {
        o.state = PENDING;
        if (o.pure) Updates.push(o);
        else Effects.push(o);
        o.observers && markDownstream(o);
      }
    }
  }
  function cleanNode(node) {
    let i;
    if (node.sources) {
      while (node.sources.length) {
        const source = node.sources.pop(),
          index = node.sourceSlots.pop(),
          obs = source.observers;
        if (obs && obs.length) {
          const n = obs.pop(),
            s = source.observerSlots.pop();
          if (index < obs.length) {
            n.sourceSlots[s] = index;
            obs[index] = n;
            source.observerSlots[index] = s;
          }
        }
      }
    }
    if (node.tOwned) {
      for (i = node.tOwned.length - 1; i >= 0; i--) cleanNode(node.tOwned[i]);
      delete node.tOwned;
    }
    if (node.owned) {
      for (i = node.owned.length - 1; i >= 0; i--) cleanNode(node.owned[i]);
      node.owned = null;
    }
    if (node.cleanups) {
      for (i = node.cleanups.length - 1; i >= 0; i--) node.cleanups[i]();
      node.cleanups = null;
    }
    node.state = 0;
  }
  function castError(err) {
    if (err instanceof Error) return err;
    return new Error(typeof err === "string" ? err : "Unknown error", {
      cause: err
    });
  }
  function handleError(err, owner = Owner) {
    const error = castError(err);
    throw error;
  }
  function resolveChildren(children) {
    if (typeof children === "function" && !children.length) return resolveChildren(children());
    if (Array.isArray(children)) {
      const results = [];
      for (let i = 0; i < children.length; i++) {
        const result = resolveChildren(children[i]);
        Array.isArray(result) ? results.push.apply(results, result) : results.push(result);
      }
      return results;
    }
    return children;
  }

  const FALLBACK = Symbol("fallback");
  function dispose(d) {
    for (let i = 0; i < d.length; i++) d[i]();
  }
  function mapArray(list, mapFn, options = {}) {
    let items = [],
      mapped = [],
      disposers = [],
      len = 0,
      indexes = mapFn.length > 1 ? [] : null;
    onCleanup(() => dispose(disposers));
    return () => {
      let newItems = list() || [],
        newLen = newItems.length,
        i,
        j;
      newItems[$TRACK];
      return untrack(() => {
        let newIndices, newIndicesNext, temp, tempdisposers, tempIndexes, start, end, newEnd, item;
        if (newLen === 0) {
          if (len !== 0) {
            dispose(disposers);
            disposers = [];
            items = [];
            mapped = [];
            len = 0;
            indexes && (indexes = []);
          }
          if (options.fallback) {
            items = [FALLBACK];
            mapped[0] = createRoot(disposer => {
              disposers[0] = disposer;
              return options.fallback();
            });
            len = 1;
          }
        } else if (len === 0) {
          mapped = new Array(newLen);
          for (j = 0; j < newLen; j++) {
            items[j] = newItems[j];
            mapped[j] = createRoot(mapper);
          }
          len = newLen;
        } else {
          temp = new Array(newLen);
          tempdisposers = new Array(newLen);
          indexes && (tempIndexes = new Array(newLen));
          for (
            start = 0, end = Math.min(len, newLen);
            start < end && items[start] === newItems[start];
            start++
          );
          for (
            end = len - 1, newEnd = newLen - 1;
            end >= start && newEnd >= start && items[end] === newItems[newEnd];
            end--, newEnd--
          ) {
            temp[newEnd] = mapped[end];
            tempdisposers[newEnd] = disposers[end];
            indexes && (tempIndexes[newEnd] = indexes[end]);
          }
          newIndices = new Map();
          newIndicesNext = new Array(newEnd + 1);
          for (j = newEnd; j >= start; j--) {
            item = newItems[j];
            i = newIndices.get(item);
            newIndicesNext[j] = i === undefined ? -1 : i;
            newIndices.set(item, j);
          }
          for (i = start; i <= end; i++) {
            item = items[i];
            j = newIndices.get(item);
            if (j !== undefined && j !== -1) {
              temp[j] = mapped[i];
              tempdisposers[j] = disposers[i];
              indexes && (tempIndexes[j] = indexes[i]);
              j = newIndicesNext[j];
              newIndices.set(item, j);
            } else disposers[i]();
          }
          for (j = start; j < newLen; j++) {
            if (j in temp) {
              mapped[j] = temp[j];
              disposers[j] = tempdisposers[j];
              if (indexes) {
                indexes[j] = tempIndexes[j];
                indexes[j](j);
              }
            } else mapped[j] = createRoot(mapper);
          }
          mapped = mapped.slice(0, (len = newLen));
          items = newItems.slice(0);
        }
        return mapped;
      });
      function mapper(disposer) {
        disposers[j] = disposer;
        if (indexes) {
          const [s, set] = createSignal(j);
          indexes[j] = set;
          return mapFn(newItems[j], s);
        }
        return mapFn(newItems[j]);
      }
    };
  }
  function indexArray(list, mapFn, options = {}) {
    let items = [],
      mapped = [],
      disposers = [],
      signals = [],
      len = 0,
      i;
    onCleanup(() => dispose(disposers));
    return () => {
      const newItems = list() || [],
        newLen = newItems.length;
      newItems[$TRACK];
      return untrack(() => {
        if (newLen === 0) {
          if (len !== 0) {
            dispose(disposers);
            disposers = [];
            items = [];
            mapped = [];
            len = 0;
            signals = [];
          }
          if (options.fallback) {
            items = [FALLBACK];
            mapped[0] = createRoot(disposer => {
              disposers[0] = disposer;
              return options.fallback();
            });
            len = 1;
          }
          return mapped;
        }
        if (items[0] === FALLBACK) {
          disposers[0]();
          disposers = [];
          items = [];
          mapped = [];
          len = 0;
        }
        for (i = 0; i < newLen; i++) {
          if (i < items.length && items[i] !== newItems[i]) {
            signals[i](() => newItems[i]);
          } else if (i >= items.length) {
            mapped[i] = createRoot(mapper);
          }
        }
        for (; i < items.length; i++) {
          disposers[i]();
        }
        len = signals.length = disposers.length = newLen;
        items = newItems.slice(0);
        return (mapped = mapped.slice(0, len));
      });
      function mapper(disposer) {
        disposers[i] = disposer;
        const [s, set] = createSignal(newItems[i]);
        signals[i] = set;
        return mapFn(s, i);
      }
    };
  }
  function createComponent(Comp, props) {
    return untrack(() => Comp(props || {}));
  }
  function trueFn() {
    return true;
  }
  const propTraps = {
    get(_, property, receiver) {
      if (property === $PROXY) return receiver;
      return _.get(property);
    },
    has(_, property) {
      if (property === $PROXY) return true;
      return _.has(property);
    },
    set: trueFn,
    deleteProperty: trueFn,
    getOwnPropertyDescriptor(_, property) {
      return {
        configurable: true,
        enumerable: true,
        get() {
          return _.get(property);
        },
        set: trueFn,
        deleteProperty: trueFn
      };
    },
    ownKeys(_) {
      return _.keys();
    }
  };
  function resolveSource(s) {
    return !(s = typeof s === "function" ? s() : s) ? {} : s;
  }
  function resolveSources() {
    for (let i = 0, length = this.length; i < length; ++i) {
      const v = this[i]();
      if (v !== undefined) return v;
    }
  }
  function mergeProps(...sources) {
    let proxy = false;
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i];
      proxy = proxy || (!!s && $PROXY in s);
      sources[i] = typeof s === "function" ? ((proxy = true), createMemo(s)) : s;
    }
    if (SUPPORTS_PROXY && proxy) {
      return new Proxy(
        {
          get(property) {
            for (let i = sources.length - 1; i >= 0; i--) {
              const v = resolveSource(sources[i])[property];
              if (v !== undefined) return v;
            }
          },
          has(property) {
            for (let i = sources.length - 1; i >= 0; i--) {
              if (property in resolveSource(sources[i])) return true;
            }
            return false;
          },
          keys() {
            const keys = [];
            for (let i = 0; i < sources.length; i++)
              keys.push(...Object.keys(resolveSource(sources[i])));
            return [...new Set(keys)];
          }
        },
        propTraps
      );
    }
    const sourcesMap = {};
    const defined = Object.create(null);
    for (let i = sources.length - 1; i >= 0; i--) {
      const source = sources[i];
      if (!source) continue;
      const sourceKeys = Object.getOwnPropertyNames(source);
      for (let i = sourceKeys.length - 1; i >= 0; i--) {
        const key = sourceKeys[i];
        if (key === "__proto__" || key === "constructor") continue;
        const desc = Object.getOwnPropertyDescriptor(source, key);
        if (!defined[key]) {
          defined[key] = desc.get
            ? {
                enumerable: true,
                configurable: true,
                get: resolveSources.bind((sourcesMap[key] = [desc.get.bind(source)]))
              }
            : desc.value !== undefined
            ? desc
            : undefined;
        } else {
          const sources = sourcesMap[key];
          if (sources) {
            if (desc.get) sources.push(desc.get.bind(source));
            else if (desc.value !== undefined) sources.push(() => desc.value);
          }
        }
      }
    }
    const target = {};
    const definedKeys = Object.keys(defined);
    for (let i = definedKeys.length - 1; i >= 0; i--) {
      const key = definedKeys[i],
        desc = defined[key];
      if (desc && desc.get) Object.defineProperty(target, key, desc);
      else target[key] = desc ? desc.value : undefined;
    }
    return target;
  }

  const narrowedError = name => `Stale read from <${name}>.`;
  function For(props) {
    const fallback = "fallback" in props && {
      fallback: () => props.fallback
    };
    return createMemo(mapArray(() => props.each, props.children, fallback || undefined));
  }
  function Index(props) {
    const fallback = "fallback" in props && {
      fallback: () => props.fallback
    };
    return createMemo(indexArray(() => props.each, props.children, fallback || undefined));
  }
  function Show(props) {
    const keyed = props.keyed;
    const conditionValue = createMemo(() => props.when, undefined, undefined);
    const condition = keyed
      ? conditionValue
      : createMemo(conditionValue, undefined, {
          equals: (a, b) => !a === !b
        });
    return createMemo(
      () => {
        const c = condition();
        if (c) {
          const child = props.children;
          const fn = typeof child === "function" && child.length > 0;
          return fn
            ? untrack(() =>
                child(
                  keyed
                    ? c
                    : () => {
                        if (!untrack(condition)) throw narrowedError("Show");
                        return conditionValue();
                      }
                )
              )
            : child;
        }
        return props.fallback;
      },
      undefined,
      undefined
    );
  }
  function Switch(props) {
    const chs = children(() => props.children);
    const switchFunc = createMemo(() => {
      const ch = chs();
      const mps = Array.isArray(ch) ? ch : [ch];
      let func = () => undefined;
      for (let i = 0; i < mps.length; i++) {
        const index = i;
        const mp = mps[i];
        const prevFunc = func;
        const conditionValue = createMemo(
          () => (prevFunc() ? undefined : mp.when),
          undefined,
          undefined
        );
        const condition = mp.keyed
          ? conditionValue
          : createMemo(conditionValue, undefined, {
              equals: (a, b) => !a === !b
            });
        func = () => prevFunc() || (condition() ? [index, conditionValue, mp] : undefined);
      }
      return func;
    });
    return createMemo(
      () => {
        const sel = switchFunc()();
        if (!sel) return props.fallback;
        const [index, conditionValue, mp] = sel;
        const child = mp.children;
        const fn = typeof child === "function" && child.length > 0;
        return fn
          ? untrack(() =>
              child(
                mp.keyed
                  ? conditionValue()
                  : () => {
                      if (untrack(switchFunc)()?.[0] !== index) throw narrowedError("Match");
                      return conditionValue();
                    }
              )
            )
          : child;
      },
      undefined,
      undefined
    );
  }
  function Match(props) {
    return props;
  }

  const memo = fn => createMemo(() => fn());

  function reconcileArrays(parentNode, a, b) {
    let bLength = b.length,
      aEnd = a.length,
      bEnd = bLength,
      aStart = 0,
      bStart = 0,
      after = a[aEnd - 1].nextSibling,
      map = null;
    while (aStart < aEnd || bStart < bEnd) {
      if (a[aStart] === b[bStart]) {
        aStart++;
        bStart++;
        continue;
      }
      while (a[aEnd - 1] === b[bEnd - 1]) {
        aEnd--;
        bEnd--;
      }
      if (aEnd === aStart) {
        const node = bEnd < bLength ? (bStart ? b[bStart - 1].nextSibling : b[bEnd - bStart]) : after;
        while (bStart < bEnd) parentNode.insertBefore(b[bStart++], node);
      } else if (bEnd === bStart) {
        while (aStart < aEnd) {
          if (!map || !map.has(a[aStart])) a[aStart].remove();
          aStart++;
        }
      } else if (a[aStart] === b[bEnd - 1] && b[bStart] === a[aEnd - 1]) {
        const node = a[--aEnd].nextSibling;
        parentNode.insertBefore(b[bStart++], a[aStart++].nextSibling);
        parentNode.insertBefore(b[--bEnd], node);
        a[aEnd] = b[bEnd];
      } else {
        if (!map) {
          map = new Map();
          let i = bStart;
          while (i < bEnd) map.set(b[i], i++);
        }
        const index = map.get(a[aStart]);
        if (index != null) {
          if (bStart < index && index < bEnd) {
            let i = aStart,
              sequence = 1,
              t;
            while (++i < aEnd && i < bEnd) {
              if ((t = map.get(a[i])) == null || t !== index + sequence) break;
              sequence++;
            }
            if (sequence > index - bStart) {
              const node = a[aStart];
              while (bStart < index) parentNode.insertBefore(b[bStart++], node);
            } else parentNode.replaceChild(b[bStart++], a[aStart++]);
          } else aStart++;
        } else a[aStart++].remove();
      }
    }
  }

  const $$EVENTS = "_$DX_DELEGATE";
  function render(code, element, init, options = {}) {
    let disposer;
    createRoot(dispose => {
      disposer = dispose;
      element === document
        ? code()
        : insert(element, code(), element.firstChild ? null : undefined, init);
    }, options.owner);
    return () => {
      disposer();
      element.textContent = "";
    };
  }
  function template(html, isImportNode, isSVG, isMathML) {
    let node;
    const create = () => {
      const t = document.createElement("template");
      t.innerHTML = html;
      return isSVG ? t.content.firstChild.firstChild : t.content.firstChild;
    };
    const fn = isImportNode
      ? () => untrack(() => document.importNode(node || (node = create()), true))
      : () => (node || (node = create())).cloneNode(true);
    fn.cloneNode = fn;
    return fn;
  }
  function delegateEvents(eventNames, document = window.document) {
    const e = document[$$EVENTS] || (document[$$EVENTS] = new Set());
    for (let i = 0, l = eventNames.length; i < l; i++) {
      const name = eventNames[i];
      if (!e.has(name)) {
        e.add(name);
        document.addEventListener(name, eventHandler);
      }
    }
  }
  function setAttribute(node, name, value) {
    if (value == null) node.removeAttribute(name);
    else node.setAttribute(name, value);
  }
  function className(node, value) {
    if (value == null) node.removeAttribute("class");
    else node.className = value;
  }
  function addEventListener(node, name, handler, delegate) {
    {
      if (Array.isArray(handler)) {
        node[`$$${name}`] = handler[0];
        node[`$$${name}Data`] = handler[1];
      } else node[`$$${name}`] = handler;
    }
  }
  function style(node, value, prev) {
    if (!value) return prev ? setAttribute(node, "style") : value;
    const nodeStyle = node.style;
    if (typeof value === "string") return (nodeStyle.cssText = value);
    typeof prev === "string" && (nodeStyle.cssText = prev = undefined);
    prev || (prev = {});
    value || (value = {});
    let v, s;
    for (s in prev) {
      value[s] == null && nodeStyle.removeProperty(s);
      delete prev[s];
    }
    for (s in value) {
      v = value[s];
      if (v !== prev[s]) {
        nodeStyle.setProperty(s, v);
        prev[s] = v;
      }
    }
    return prev;
  }
  function use(fn, element, arg) {
    return untrack(() => fn(element, arg));
  }
  function insert(parent, accessor, marker, initial) {
    if (marker !== undefined && !initial) initial = [];
    if (typeof accessor !== "function") return insertExpression(parent, accessor, initial, marker);
    createRenderEffect(current => insertExpression(parent, accessor(), current, marker), initial);
  }
  function eventHandler(e) {
    let node = e.target;
    const key = `$$${e.type}`;
    const oriTarget = e.target;
    const oriCurrentTarget = e.currentTarget;
    const retarget = value =>
      Object.defineProperty(e, "target", {
        configurable: true,
        value
      });
    const handleNode = () => {
      const handler = node[key];
      if (handler && !node.disabled) {
        const data = node[`${key}Data`];
        data !== undefined ? handler.call(node, data, e) : handler.call(node, e);
        if (e.cancelBubble) return;
      }
      node.host &&
        typeof node.host !== "string" &&
        !node.host._$host &&
        node.contains(e.target) &&
        retarget(node.host);
      return true;
    };
    const walkUpTree = () => {
      while (handleNode() && (node = node._$host || node.parentNode || node.host));
    };
    Object.defineProperty(e, "currentTarget", {
      configurable: true,
      get() {
        return node || document;
      }
    });
    if (e.composedPath) {
      const path = e.composedPath();
      retarget(path[0]);
      for (let i = 0; i < path.length - 2; i++) {
        node = path[i];
        if (!handleNode()) break;
        if (node._$host) {
          node = node._$host;
          walkUpTree();
          break;
        }
        if (node.parentNode === oriCurrentTarget) {
          break;
        }
      }
    } else walkUpTree();
    retarget(oriTarget);
  }
  function insertExpression(parent, value, current, marker, unwrapArray) {
    while (typeof current === "function") current = current();
    if (value === current) return current;
    const t = typeof value,
      multi = marker !== undefined;
    parent = (multi && current[0] && current[0].parentNode) || parent;
    if (t === "string" || t === "number") {
      if (t === "number") {
        value = value.toString();
        if (value === current) return current;
      }
      if (multi) {
        let node = current[0];
        if (node && node.nodeType === 3) {
          node.data !== value && (node.data = value);
        } else node = document.createTextNode(value);
        current = cleanChildren(parent, current, marker, node);
      } else {
        if (current !== "" && typeof current === "string") {
          current = parent.firstChild.data = value;
        } else current = parent.textContent = value;
      }
    } else if (value == null || t === "boolean") {
      current = cleanChildren(parent, current, marker);
    } else if (t === "function") {
      createRenderEffect(() => {
        let v = value();
        while (typeof v === "function") v = v();
        current = insertExpression(parent, v, current, marker);
      });
      return () => current;
    } else if (Array.isArray(value)) {
      const array = [];
      const currentArray = current && Array.isArray(current);
      if (normalizeIncomingArray(array, value, current, unwrapArray)) {
        createRenderEffect(() => (current = insertExpression(parent, array, current, marker, true)));
        return () => current;
      }
      if (array.length === 0) {
        current = cleanChildren(parent, current, marker);
        if (multi) return current;
      } else if (currentArray) {
        if (current.length === 0) {
          appendNodes(parent, array, marker);
        } else reconcileArrays(parent, current, array);
      } else {
        current && cleanChildren(parent);
        appendNodes(parent, array);
      }
      current = array;
    } else if (value.nodeType) {
      if (Array.isArray(current)) {
        if (multi) return (current = cleanChildren(parent, current, marker, value));
        cleanChildren(parent, current, null, value);
      } else if (current == null || current === "" || !parent.firstChild) {
        parent.appendChild(value);
      } else parent.replaceChild(value, parent.firstChild);
      current = value;
    } else;
    return current;
  }
  function normalizeIncomingArray(normalized, array, current, unwrap) {
    let dynamic = false;
    for (let i = 0, len = array.length; i < len; i++) {
      let item = array[i],
        prev = current && current[normalized.length],
        t;
      if (item == null || item === true || item === false);
      else if ((t = typeof item) === "object" && item.nodeType) {
        normalized.push(item);
      } else if (Array.isArray(item)) {
        dynamic = normalizeIncomingArray(normalized, item, prev) || dynamic;
      } else if (t === "function") {
        if (unwrap) {
          while (typeof item === "function") item = item();
          dynamic =
            normalizeIncomingArray(
              normalized,
              Array.isArray(item) ? item : [item],
              Array.isArray(prev) ? prev : [prev]
            ) || dynamic;
        } else {
          normalized.push(item);
          dynamic = true;
        }
      } else {
        const value = String(item);
        if (prev && prev.nodeType === 3 && prev.data === value) normalized.push(prev);
        else normalized.push(document.createTextNode(value));
      }
    }
    return dynamic;
  }
  function appendNodes(parent, array, marker = null) {
    for (let i = 0, len = array.length; i < len; i++) parent.insertBefore(array[i], marker);
  }
  function cleanChildren(parent, current, marker, replacement) {
    if (marker === undefined) return (parent.textContent = "");
    const node = replacement || document.createTextNode("");
    if (current.length) {
      let inserted = false;
      for (let i = current.length - 1; i >= 0; i--) {
        const el = current[i];
        if (node !== el) {
          const isParent = el.parentNode === parent;
          if (!inserted && !i)
            isParent ? parent.replaceChild(node, el) : parent.insertBefore(node, marker);
          else isParent && el.remove();
        } else inserted = true;
      }
    } else parent.insertBefore(node, marker);
    return [node];
  }

  const $RAW = Symbol("store-raw"),
    $NODE = Symbol("store-node"),
    $HAS = Symbol("store-has"),
    $SELF = Symbol("store-self");
  function wrap$1(value) {
    let p = value[$PROXY];
    if (!p) {
      Object.defineProperty(value, $PROXY, {
        value: (p = new Proxy(value, proxyTraps$1))
      });
      if (!Array.isArray(value)) {
        const keys = Object.keys(value),
          desc = Object.getOwnPropertyDescriptors(value);
        for (let i = 0, l = keys.length; i < l; i++) {
          const prop = keys[i];
          if (desc[prop].get) {
            Object.defineProperty(value, prop, {
              enumerable: desc[prop].enumerable,
              get: desc[prop].get.bind(p)
            });
          }
        }
      }
    }
    return p;
  }
  function isWrappable(obj) {
    let proto;
    return (
      obj != null &&
      typeof obj === "object" &&
      (obj[$PROXY] ||
        !(proto = Object.getPrototypeOf(obj)) ||
        proto === Object.prototype ||
        Array.isArray(obj))
    );
  }
  function unwrap(item, set = new Set()) {
    let result, unwrapped, v, prop;
    if ((result = item != null && item[$RAW])) return result;
    if (!isWrappable(item) || set.has(item)) return item;
    if (Array.isArray(item)) {
      if (Object.isFrozen(item)) item = item.slice(0);
      else set.add(item);
      for (let i = 0, l = item.length; i < l; i++) {
        v = item[i];
        if ((unwrapped = unwrap(v, set)) !== v) item[i] = unwrapped;
      }
    } else {
      if (Object.isFrozen(item)) item = Object.assign({}, item);
      else set.add(item);
      const keys = Object.keys(item),
        desc = Object.getOwnPropertyDescriptors(item);
      for (let i = 0, l = keys.length; i < l; i++) {
        prop = keys[i];
        if (desc[prop].get) continue;
        v = item[prop];
        if ((unwrapped = unwrap(v, set)) !== v) item[prop] = unwrapped;
      }
    }
    return item;
  }
  function getNodes(target, symbol) {
    let nodes = target[symbol];
    if (!nodes)
      Object.defineProperty(target, symbol, {
        value: (nodes = Object.create(null))
      });
    return nodes;
  }
  function getNode(nodes, property, value) {
    if (nodes[property]) return nodes[property];
    const [s, set] = createSignal(value, {
      equals: false,
      internal: true
    });
    s.$ = set;
    return (nodes[property] = s);
  }
  function proxyDescriptor$1(target, property) {
    const desc = Reflect.getOwnPropertyDescriptor(target, property);
    if (!desc || desc.get || !desc.configurable || property === $PROXY || property === $NODE)
      return desc;
    delete desc.value;
    delete desc.writable;
    desc.get = () => target[$PROXY][property];
    return desc;
  }
  function trackSelf(target) {
    getListener() && getNode(getNodes(target, $NODE), $SELF)();
  }
  function ownKeys(target) {
    trackSelf(target);
    return Reflect.ownKeys(target);
  }
  const proxyTraps$1 = {
    get(target, property, receiver) {
      if (property === $RAW) return target;
      if (property === $PROXY) return receiver;
      if (property === $TRACK) {
        trackSelf(target);
        return receiver;
      }
      const nodes = getNodes(target, $NODE);
      const tracked = nodes[property];
      let value = tracked ? tracked() : target[property];
      if (property === $NODE || property === $HAS || property === "__proto__") return value;
      if (!tracked) {
        const desc = Object.getOwnPropertyDescriptor(target, property);
        if (
          getListener() &&
          (typeof value !== "function" || target.hasOwnProperty(property)) &&
          !(desc && desc.get)
        )
          value = getNode(nodes, property, value)();
      }
      return isWrappable(value) ? wrap$1(value) : value;
    },
    has(target, property) {
      if (
        property === $RAW ||
        property === $PROXY ||
        property === $TRACK ||
        property === $NODE ||
        property === $HAS ||
        property === "__proto__"
      )
        return true;
      getListener() && getNode(getNodes(target, $HAS), property)();
      return property in target;
    },
    set() {
      return true;
    },
    deleteProperty() {
      return true;
    },
    ownKeys: ownKeys,
    getOwnPropertyDescriptor: proxyDescriptor$1
  };
  function setProperty(state, property, value, deleting = false) {
    if (!deleting && state[property] === value) return;
    const prev = state[property],
      len = state.length;
    if (value === undefined) {
      delete state[property];
      if (state[$HAS] && state[$HAS][property] && prev !== undefined) state[$HAS][property].$();
    } else {
      state[property] = value;
      if (state[$HAS] && state[$HAS][property] && prev === undefined) state[$HAS][property].$();
    }
    let nodes = getNodes(state, $NODE),
      node;
    if ((node = getNode(nodes, property, prev))) node.$(() => value);
    if (Array.isArray(state) && state.length !== len) {
      for (let i = state.length; i < len; i++) (node = nodes[i]) && node.$();
      (node = getNode(nodes, "length", len)) && node.$(state.length);
    }
    (node = nodes[$SELF]) && node.$();
  }
  function mergeStoreNode(state, value) {
    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      setProperty(state, key, value[key]);
    }
  }
  function updateArray(current, next) {
    if (typeof next === "function") next = next(current);
    next = unwrap(next);
    if (Array.isArray(next)) {
      if (current === next) return;
      let i = 0,
        len = next.length;
      for (; i < len; i++) {
        const value = next[i];
        if (current[i] !== value) setProperty(current, i, value);
      }
      setProperty(current, "length", len);
    } else mergeStoreNode(current, next);
  }
  function updatePath(current, path, traversed = []) {
    let part,
      prev = current;
    if (path.length > 1) {
      part = path.shift();
      const partType = typeof part,
        isArray = Array.isArray(current);
      if (Array.isArray(part)) {
        for (let i = 0; i < part.length; i++) {
          updatePath(current, [part[i]].concat(path), traversed);
        }
        return;
      } else if (isArray && partType === "function") {
        for (let i = 0; i < current.length; i++) {
          if (part(current[i], i)) updatePath(current, [i].concat(path), traversed);
        }
        return;
      } else if (isArray && partType === "object") {
        const { from = 0, to = current.length - 1, by = 1 } = part;
        for (let i = from; i <= to; i += by) {
          updatePath(current, [i].concat(path), traversed);
        }
        return;
      } else if (path.length > 1) {
        updatePath(current[part], path, [part].concat(traversed));
        return;
      }
      prev = current[part];
      traversed = [part].concat(traversed);
    }
    let value = path[0];
    if (typeof value === "function") {
      value = value(prev, traversed);
      if (value === prev) return;
    }
    if (part === undefined && value == undefined) return;
    value = unwrap(value);
    if (part === undefined || (isWrappable(prev) && isWrappable(value) && !Array.isArray(value))) {
      mergeStoreNode(prev, value);
    } else setProperty(current, part, value);
  }
  function createStore(...[store, options]) {
    const unwrappedStore = unwrap(store || {});
    const isArray = Array.isArray(unwrappedStore);
    const wrappedStore = wrap$1(unwrappedStore);
    function setStore(...args) {
      batch(() => {
        isArray && args.length === 1
          ? updateArray(unwrappedStore, args[0])
          : updatePath(unwrappedStore, args);
      });
    }
    return [wrappedStore, setStore];
  }

  const $ROOT = Symbol("store-root");
  function applyState(target, parent, property, merge, key) {
    const previous = parent[property];
    if (target === previous) return;
    const isArray = Array.isArray(target);
    if (
      property !== $ROOT &&
      (!isWrappable(target) ||
        !isWrappable(previous) ||
        isArray !== Array.isArray(previous) ||
        (key && target[key] !== previous[key]))
    ) {
      setProperty(parent, property, target);
      return;
    }
    if (isArray) {
      if (
        target.length &&
        previous.length &&
        (!merge || (key && target[0] && target[0][key] != null))
      ) {
        let i, j, start, end, newEnd, item, newIndicesNext, keyVal;
        for (
          start = 0, end = Math.min(previous.length, target.length);
          start < end &&
          (previous[start] === target[start] ||
            (key && previous[start] && target[start] && previous[start][key] === target[start][key]));
          start++
        ) {
          applyState(target[start], previous, start, merge, key);
        }
        const temp = new Array(target.length),
          newIndices = new Map();
        for (
          end = previous.length - 1, newEnd = target.length - 1;
          end >= start &&
          newEnd >= start &&
          (previous[end] === target[newEnd] ||
            (key && previous[end] && target[newEnd] && previous[end][key] === target[newEnd][key]));
          end--, newEnd--
        ) {
          temp[newEnd] = previous[end];
        }
        if (start > newEnd || start > end) {
          for (j = start; j <= newEnd; j++) setProperty(previous, j, target[j]);
          for (; j < target.length; j++) {
            setProperty(previous, j, temp[j]);
            applyState(target[j], previous, j, merge, key);
          }
          if (previous.length > target.length) setProperty(previous, "length", target.length);
          return;
        }
        newIndicesNext = new Array(newEnd + 1);
        for (j = newEnd; j >= start; j--) {
          item = target[j];
          keyVal = key && item ? item[key] : item;
          i = newIndices.get(keyVal);
          newIndicesNext[j] = i === undefined ? -1 : i;
          newIndices.set(keyVal, j);
        }
        for (i = start; i <= end; i++) {
          item = previous[i];
          keyVal = key && item ? item[key] : item;
          j = newIndices.get(keyVal);
          if (j !== undefined && j !== -1) {
            temp[j] = previous[i];
            j = newIndicesNext[j];
            newIndices.set(keyVal, j);
          }
        }
        for (j = start; j < target.length; j++) {
          if (j in temp) {
            setProperty(previous, j, temp[j]);
            applyState(target[j], previous, j, merge, key);
          } else setProperty(previous, j, target[j]);
        }
      } else {
        for (let i = 0, len = target.length; i < len; i++) {
          applyState(target[i], previous, i, merge, key);
        }
      }
      if (previous.length > target.length) setProperty(previous, "length", target.length);
      return;
    }
    const targetKeys = Object.keys(target);
    for (let i = 0, len = targetKeys.length; i < len; i++) {
      applyState(target[targetKeys[i]], previous, targetKeys[i], merge, key);
    }
    const previousKeys = Object.keys(previous);
    for (let i = 0, len = previousKeys.length; i < len; i++) {
      if (target[previousKeys[i]] === undefined) setProperty(previous, previousKeys[i], undefined);
    }
  }
  function reconcile(value, options = {}) {
    const { merge, key = "id" } = options,
      v = unwrap(value);
    return state => {
      if (!isWrappable(state) || !isWrappable(v)) return v;
      const res = applyState(
        v,
        {
          [$ROOT]: state
        },
        $ROOT,
        merge,
        key
      );
      return res === undefined ? state : res;
    };
  }

  const noop = () => {
      /* noop */
  };
  const noopTransition = (el, done) => done();
  /**
   * Create an element transition interface for switching between single elements.
   * It can be used to implement own transition effect, or a custom `<Transition>`-like component.
   *
   * It will observe {@link source} and return a signal with array of elements to be rendered (current one and exiting ones).
   *
   * @param source a signal with the current element. Any nullish value will mean there is no element.
   * Any object can used as the source, but most likely you will want to use a `HTMLElement` or `SVGElement`.
   * @param options transition options {@link SwitchTransitionOptions}
   * @returns a signal with an array of the current element and exiting previous elements.
   *
   * @see https://github.com/solidjs-community/solid-primitives/tree/main/packages/transition-group#createSwitchTransition
   *
   * @example
   * const [el, setEl] = createSignal<HTMLDivElement>();
   *
   * const rendered = createSwitchTransition(el, {
   *   onEnter(el, done) {
   *     // the enter callback is called before the element is inserted into the DOM
   *     // so run the animation in the next animation frame / microtask
   *     queueMicrotask(() => { ... })
   *   },
   *   onExit(el, done) {
   *     // the exitting element is kept in the DOM until the done() callback is called
   *   },
   * })
   *
   * // change the source to trigger the transition
   * setEl(refToHtmlElement);
   */
  function createSwitchTransition(source, options) {
      const initSource = untrack(source);
      const initReturned = initSource ? [initSource] : [];
      const { onEnter = noopTransition, onExit = noopTransition } = options;
      const [returned, setReturned] = createSignal(options.appear ? [] : initReturned);
      const [isTransitionPending] = useTransition();
      let next;
      let isExiting = false;
      function exitTransition(el, after) {
          if (!el)
              return after && after();
          isExiting = true;
          onExit(el, () => {
              batch(() => {
                  isExiting = false;
                  setReturned(p => p.filter(e => e !== el));
                  after && after();
              });
          });
      }
      function enterTransition(after) {
          const el = next;
          if (!el)
              return after && after();
          next = undefined;
          setReturned(p => [el, ...p]);
          onEnter(el, after ?? noop);
      }
      const triggerTransitions = options.mode === "out-in"
          ? // exit -> enter
              // exit -> enter
              prev => isExiting || exitTransition(prev, enterTransition)
          : options.mode === "in-out"
              ? // enter -> exit
                  // enter -> exit
                  prev => enterTransition(() => exitTransition(prev))
              : // exit & enter
                  // exit & enter
                  prev => {
                      exitTransition(prev);
                      enterTransition();
                  };
      createComputed((prev) => {
          const el = source();
          if (untrack(isTransitionPending)) {
              // wait for pending transition to end before animating
              isTransitionPending();
              return prev;
          }
          if (el !== prev) {
              next = el;
              batch(() => untrack(() => triggerTransitions(prev)));
          }
          return el;
      }, options.appear ? undefined : initSource);
      return returned;
  }

  /**
   * Default predicate used in `resolveElements()` and `resolveFirst()` to filter Elements.
   *
   * On the client it uses `instanceof Element` check, on the server it checks for the object with `t` property. (generated by compiling JSX)
   */
  const defaultElementPredicate = (item) => item instanceof Element;
  /**
   * Utility for resolving recursively nested JSX children in search of the first element that matches a predicate.
   *
   * It does **not** create a computation - should be wrapped in one to repeat the resolution on changes.
   *
   * @param value JSX children
   * @param predicate predicate to filter elements
   * @returns single found element or `null` if no elements were found
   */
  function getFirstChild(value, predicate) {
      if (predicate(value))
          return value;
      if (typeof value === "function" && !value.length)
          return getFirstChild(value(), predicate);
      if (Array.isArray(value)) {
          for (const item of value) {
              const result = getFirstChild(item, predicate);
              if (result)
                  return result;
          }
      }
      return null;
  }
  function resolveFirst(fn, predicate = defaultElementPredicate, serverPredicate = defaultElementPredicate) {
      const children = createMemo(fn);
      return createMemo(() => getFirstChild(children(), predicate));
  }

  // src/common.ts
  function createClassnames(props) {
    return createMemo(() => {
      const name = props.name || "s";
      return {
        enterActive: (props.enterActiveClass || name + "-enter-active").split(" "),
        enter: (props.enterClass || name + "-enter").split(" "),
        enterTo: (props.enterToClass || name + "-enter-to").split(" "),
        exitActive: (props.exitActiveClass || name + "-exit-active").split(" "),
        exit: (props.exitClass || name + "-exit").split(" "),
        exitTo: (props.exitToClass || name + "-exit-to").split(" "),
        move: (props.moveClass || name + "-move").split(" ")
      };
    });
  }
  function nextFrame(fn) {
    requestAnimationFrame(() => requestAnimationFrame(fn));
  }
  function enterTransition(classes, events, el, done) {
    const { onBeforeEnter, onEnter, onAfterEnter } = events;
    onBeforeEnter?.(el);
    el.classList.add(...classes.enter);
    el.classList.add(...classes.enterActive);
    queueMicrotask(() => {
      if (!el.parentNode)
        return done?.();
      onEnter?.(el, () => endTransition());
    });
    nextFrame(() => {
      el.classList.remove(...classes.enter);
      el.classList.add(...classes.enterTo);
      if (!onEnter || onEnter.length < 2) {
        el.addEventListener("transitionend", endTransition);
        el.addEventListener("animationend", endTransition);
      }
    });
    function endTransition(e) {
      if (!e || e.target === el) {
        done?.();
        el.removeEventListener("transitionend", endTransition);
        el.removeEventListener("animationend", endTransition);
        el.classList.remove(...classes.enterActive);
        el.classList.remove(...classes.enterTo);
        onAfterEnter?.(el);
      }
    }
  }
  function exitTransition(classes, events, el, done) {
    const { onBeforeExit, onExit, onAfterExit } = events;
    if (!el.parentNode)
      return done?.();
    onBeforeExit?.(el);
    el.classList.add(...classes.exit);
    el.classList.add(...classes.exitActive);
    onExit?.(el, () => endTransition());
    nextFrame(() => {
      el.classList.remove(...classes.exit);
      el.classList.add(...classes.exitTo);
      if (!onExit || onExit.length < 2) {
        el.addEventListener("transitionend", endTransition);
        el.addEventListener("animationend", endTransition);
      }
    });
    function endTransition(e) {
      if (!e || e.target === el) {
        done?.();
        el.removeEventListener("transitionend", endTransition);
        el.removeEventListener("animationend", endTransition);
        el.classList.remove(...classes.exitActive);
        el.classList.remove(...classes.exitTo);
        onAfterExit?.(el);
      }
    }
  }
  var TRANSITION_MODE_MAP = {
    inout: "in-out",
    outin: "out-in"
  };
  var Transition = (props) => {
    const classnames = createClassnames(props);
    return createSwitchTransition(
      resolveFirst(() => props.children),
      {
        mode: TRANSITION_MODE_MAP[props.mode],
        appear: props.appear,
        onEnter(el, done) {
          enterTransition(classnames(), props, el, done);
        },
        onExit(el, done) {
          exitTransition(classnames(), props, el, done);
        }
      }
    );
  };

  const _tmpl$$g = /*#__PURE__*/template(`<span></span>`, 2);
  var Segment = (props => {
    const codePoint = createMemo(() => {
      if (props.t.length == 1) {
        const cp = props.t.codePointAt(0);

        // box drawing chars, block elements and some Powerline symbols
        // are rendered with CSS classes (cp-<codepoint>)
        if (cp >= 0x2580 && cp <= 0x259f || cp >= 0xe0b0 && cp <= 0xe0b3) {
          return cp;
        }
      }
    });
    const text = createMemo(() => codePoint() ? " " : props.t);
    const style$1 = createMemo(() => buildStyle(props.p, props.x, props.w, props.cursor));
    const className$1 = createMemo(() => buildClassName(props.p, codePoint(), props.w, props.cursor));
    return (() => {
      const _el$ = _tmpl$$g.cloneNode(true);
      insert(_el$, text);
      createRenderEffect(_p$ => {
        const _v$ = className$1(),
          _v$2 = style$1();
        _v$ !== _p$._v$ && className(_el$, _p$._v$ = _v$);
        _p$._v$2 = style(_el$, _v$2, _p$._v$2);
        return _p$;
      }, {
        _v$: undefined,
        _v$2: undefined
      });
      return _el$;
    })();
  });
  function buildClassName(attrs, codePoint, width, cursor) {
    let cls = cursor ? "ap-cursor" : "";
    if (codePoint !== undefined) {
      cls += ` cp-${codePoint.toString(16)}`;
    }
    if (attrs.has("bold") || isBrightColor(attrs.get("fg"))) {
      cls += " ap-bright";
    }
    if (attrs.has("faint")) {
      cls += " ap-faint";
    }
    if (attrs.has("italic")) {
      cls += " ap-italic";
    }
    if (attrs.has("underline")) {
      cls += " ap-underline";
    }
    if (attrs.has("blink")) {
      cls += " ap-blink";
    }
    if (attrs.get("inverse")) {
      cls += " ap-inverse";
    }
    if (width == 1) {
      cls += " ap-symbol";
    }
    if (cls === "") {
      return undefined;
    } else {
      return cls;
    }
  }
  function isBrightColor(color) {
    return typeof color === "number" && color >= 8 && color <= 15;
  }
  function buildStyle(attrs, offset, width, cursor) {
    let style = {
      "--offset": offset,
      width: `${width + 0.01}ch`
    };
    const fg = colorValue(attrs.get("fg"), attrs.get("bold"));
    if (fg) {
      style["--fg"] = fg;
    }
    if (cursor) {
      const bg = colorValue(attrs.get("bg"), false);
      if (bg) {
        style["--bg"] = bg;
      }
    }
    return style;
  }
  function colorValue(color, intense) {
    if (typeof color === "number") {
      if (intense && color < 8) {
        color += 8;
      }
      return `var(--term-color-${color})`;
    } else if (typeof color === "string") {
      return color;
    }
  }

  const _tmpl$$f = /*#__PURE__*/template(`<span class="ap-line" role="paragraph"></span>`, 2);
  var Line = (props => {
    const segments = () => {
      if (typeof props.cursor === "number") {
        const segs = [];
        let x = 0;
        let segIndex = 0;
        while (segIndex < props.segments.length && x + props.segments[segIndex].w - 1 < props.cursor) {
          const seg = props.segments[segIndex];
          segs.push(seg);
          x += seg.w;
          segIndex++;
        }
        if (segIndex < props.segments.length) {
          const seg = props.segments[segIndex];
          const charWidth = seg.W;
          let cellIndex = props.cursor - x;
          const charIndex = Math.floor(cellIndex / charWidth);
          cellIndex = charIndex * charWidth;
          const chars = Array.from(seg.t);
          if (charIndex > 0) {
            segs.push({
              ...seg,
              t: chars.slice(0, charIndex).join("")
            });
          }
          segs.push({
            ...seg,
            t: chars[charIndex],
            x: x + cellIndex,
            w: charWidth,
            cursor: true
          });
          if (charIndex < chars.length - 1) {
            segs.push({
              ...seg,
              t: chars.slice(charIndex + 1).join(""),
              x: x + cellIndex + 1,
              w: seg.w - charWidth
            });
          }
          segIndex++;
          while (segIndex < props.segments.length) {
            const seg = props.segments[segIndex];
            segs.push(seg);
            segIndex++;
          }
        }
        return segs;
      } else {
        return props.segments;
      }
    };
    return (() => {
      const _el$ = _tmpl$$f.cloneNode(true);
      insert(_el$, createComponent(Index, {
        get each() {
          return segments();
        },
        children: s => createComponent(Segment, mergeProps(s))
      }));
      return _el$;
    })();
  });

  const _tmpl$$e = /*#__PURE__*/template(`<div class="ap-term"><svg class="ap-term-bg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true"><g shape-rendering="crispEdges"></g></svg><pre class="ap-term-text" aria-live="off" tabindex="0"></pre></div>`, 8),
    _tmpl$2$2 = /*#__PURE__*/template(`<svg><rect height="1.01"></rect></svg>`, 4, true);
  var Terminal = (props => {
    const lineHeight = () => props.lineHeight ?? 1.3333333333;
    const style$1 = createMemo(() => {
      return {
        width: `${props.cols}ch`,
        height: `${lineHeight() * props.rows}em`,
        "font-size": `${(props.scale || 1.0) * 100}%`,
        "--term-line-height": `${lineHeight()}em`,
        "--term-cols": props.cols
      };
    });
    function bgStyle(color) {
      if (typeof color === "number") {
        return {
          fill: `var(--term-color-${color})`
        };
      } else if (typeof color === "string") {
        if (color == "fg") {
          return {
            fill: "var(--term-color-foreground)"
          };
        } else {
          return {
            fill: color
          };
        }
      }
    }
    const cursorCol = createMemo(() => props.cursor?.[0]);
    const cursorRow = createMemo(() => props.cursor?.[1]);
    return (() => {
      const _el$ = _tmpl$$e.cloneNode(true),
        _el$2 = _el$.firstChild,
        _el$3 = _el$2.firstChild,
        _el$4 = _el$2.nextSibling;
      insert(_el$3, createComponent(For, {
        get each() {
          return props.lines;
        },
        children: (line, row) => createComponent(For, {
          get each() {
            return line.bg;
          },
          children: (span, _i) => (() => {
            const _el$5 = _tmpl$2$2.cloneNode(true);
            createRenderEffect(_p$ => {
              const _v$5 = span.x,
                _v$6 = row(),
                _v$7 = span.w,
                _v$8 = bgStyle(span.c);
              _v$5 !== _p$._v$5 && setAttribute(_el$5, "x", _p$._v$5 = _v$5);
              _v$6 !== _p$._v$6 && setAttribute(_el$5, "y", _p$._v$6 = _v$6);
              _v$7 !== _p$._v$7 && setAttribute(_el$5, "width", _p$._v$7 = _v$7);
              _p$._v$8 = style(_el$5, _v$8, _p$._v$8);
              return _p$;
            }, {
              _v$5: undefined,
              _v$6: undefined,
              _v$7: undefined,
              _v$8: undefined
            });
            return _el$5;
          })()
        })
      }));
      const _ref$ = props.ref;
      typeof _ref$ === "function" ? use(_ref$, _el$4) : props.ref = _el$4;
      insert(_el$4, createComponent(For, {
        get each() {
          return props.lines;
        },
        children: (line, i) => createComponent(Line, {
          get segments() {
            return line.fg;
          },
          get row() {
            return i();
          },
          get cursor() {
            return memo(() => i() === cursorRow())() ? cursorCol() : null;
          }
        })
      }));
      createRenderEffect(_p$ => {
        const _v$ = style$1(),
          _v$2 = `0 0 ${props.cols} ${props.rows}`,
          _v$3 = !!(props.blink || props.cursorHold),
          _v$4 = !!props.blink;
        _p$._v$ = style(_el$, _v$, _p$._v$);
        _v$2 !== _p$._v$2 && setAttribute(_el$2, "viewBox", _p$._v$2 = _v$2);
        _v$3 !== _p$._v$3 && _el$4.classList.toggle("ap-cursor-on", _p$._v$3 = _v$3);
        _v$4 !== _p$._v$4 && _el$4.classList.toggle("ap-blink", _p$._v$4 = _v$4);
        return _p$;
      }, {
        _v$: undefined,
        _v$2: undefined,
        _v$3: undefined,
        _v$4: undefined
      });
      return _el$;
    })();
  });

  const _tmpl$$d = /*#__PURE__*/template(`<svg version="1.1" viewBox="0 0 12 12" class="ap-icon ap-icon-fullscreen-off"><path d="M7,5 L7,0 L9,2 L11,0 L12,1 L10,3 L12,5 Z"></path><path d="M5,7 L0,7 L2,9 L0,11 L1,12 L3,10 L5,12 Z"></path></svg>`, 6);
  var ExpandIcon = (props => {
    return _tmpl$$d.cloneNode(true);
  });

  const _tmpl$$c = /*#__PURE__*/template(`<svg version="1.1" viewBox="6 8 14 16" class="ap-icon"><path d="M0.938 8.313h22.125c0.5 0 0.938 0.438 0.938 0.938v13.5c0 0.5-0.438 0.938-0.938 0.938h-22.125c-0.5 0-0.938-0.438-0.938-0.938v-13.5c0-0.5 0.438-0.938 0.938-0.938zM1.594 22.063h20.813v-12.156h-20.813v12.156zM3.844 11.188h1.906v1.938h-1.906v-1.938zM7.469 11.188h1.906v1.938h-1.906v-1.938zM11.031 11.188h1.938v1.938h-1.938v-1.938zM14.656 11.188h1.875v1.938h-1.875v-1.938zM18.25 11.188h1.906v1.938h-1.906v-1.938zM5.656 15.031h1.938v1.938h-1.938v-1.938zM9.281 16.969v-1.938h1.906v1.938h-1.906zM12.875 16.969v-1.938h1.906v1.938h-1.906zM18.406 16.969h-1.938v-1.938h1.938v1.938zM16.531 20.781h-9.063v-1.906h9.063v1.906z"></path></svg>`, 4);
  var KeyboardIcon = (props => {
    return _tmpl$$c.cloneNode(true);
  });

  const _tmpl$$b = /*#__PURE__*/template(`<svg version="1.1" viewBox="0 0 12 12" class="ap-icon" aria-label="Pause" role="button"><path d="M1,0 L4,0 L4,12 L1,12 Z"></path><path d="M8,0 L11,0 L11,12 L8,12 Z"></path></svg>`, 6);
  var PauseIcon = (props => {
    return _tmpl$$b.cloneNode(true);
  });

  const _tmpl$$a = /*#__PURE__*/template(`<svg version="1.1" viewBox="0 0 12 12" class="ap-icon" aria-label="Play" role="button"><path d="M1,0 L11,6 L1,12 Z"></path></svg>`, 4);
  var PlayIcon = (props => {
    return _tmpl$$a.cloneNode(true);
  });

  const _tmpl$$9 = /*#__PURE__*/template(`<svg version="1.1" viewBox="0 0 12 12" class="ap-icon ap-icon-fullscreen-on"><path d="M12,0 L7,0 L9,2 L7,4 L8,5 L10,3 L12,5 Z"></path><path d="M0,12 L0,7 L2,9 L4,7 L5,8 L3,10 L5,12 Z"></path></svg>`, 6);
  var ShrinkIcon = (props => {
    return _tmpl$$9.cloneNode(true);
  });

  const _tmpl$$8 = /*#__PURE__*/template(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M10.5 3.75a.75.75 0 0 0-1.264-.546L5.203 7H2.667a.75.75 0 0 0-.7.48A6.985 6.985 0 0 0 1.5 10c0 .887.165 1.737.468 2.52.111.29.39.48.7.48h2.535l4.033 3.796a.75.75 0 0 0 1.264-.546V3.75ZM16.45 5.05a.75.75 0 0 0-1.06 1.061 5.5 5.5 0 0 1 0 7.778.75.75 0 0 0 1.06 1.06 7 7 0 0 0 0-9.899Z"></path><path d="M14.329 7.172a.75.75 0 0 0-1.061 1.06 2.5 2.5 0 0 1 0 3.536.75.75 0 0 0 1.06 1.06 4 4 0 0 0 0-5.656Z"></path></svg>`, 6);
  var SpeakerOnIcon = (props => {
    return _tmpl$$8.cloneNode(true);
  });

  const _tmpl$$7 = /*#__PURE__*/template(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-5"><path d="M10.047 3.062a.75.75 0 0 1 .453.688v12.5a.75.75 0 0 1-1.264.546L5.203 13H2.667a.75.75 0 0 1-.7-.48A6.985 6.985 0 0 1 1.5 10c0-.887.165-1.737.468-2.52a.75.75 0 0 1 .7-.48h2.535l4.033-3.796a.75.75 0 0 1 .811-.142ZM13.78 7.22a.75.75 0 1 0-1.06 1.06L14.44 10l-1.72 1.72a.75.75 0 0 0 1.06 1.06l1.72-1.72 1.72 1.72a.75.75 0 1 0 1.06-1.06L16.56 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L15.5 8.94l-1.72-1.72Z"></path></svg>`, 4);
  var SpeakerOffIcon = (props => {
    return _tmpl$$7.cloneNode(true);
  });

  const _tmpl$$6 = /*#__PURE__*/template(`<span class="ap-button ap-playback-button" tabindex="0"></span>`, 2),
    _tmpl$2$1 = /*#__PURE__*/template(`<span class="ap-bar"><span class="ap-gutter ap-gutter-empty"></span><span class="ap-gutter ap-gutter-full"></span></span>`, 6),
    _tmpl$3$1 = /*#__PURE__*/template(`<span class="ap-tooltip">Unmute (m)</span>`, 2),
    _tmpl$4$1 = /*#__PURE__*/template(`<span class="ap-tooltip">Mute (m)</span>`, 2),
    _tmpl$5$1 = /*#__PURE__*/template(`<span class="ap-button ap-speaker-button ap-tooltip-container" aria-label="Mute / unmute" role="button" tabindex="0"></span>`, 2),
    _tmpl$6$1 = /*#__PURE__*/template(`<div class="ap-control-bar"><span class="ap-timer" aria-readonly="true" role="textbox" tabindex="0"><span class="ap-time-elapsed"></span><span class="ap-time-remaining"></span></span><span class="ap-progressbar"></span><span class="ap-button ap-kbd-button ap-tooltip-container" aria-label="Show keyboard shortcuts" role="button" tabindex="0"><span class="ap-tooltip">Keyboard shortcuts (?)</span></span><span class="ap-button ap-fullscreen-button ap-tooltip-container" aria-label="Toggle fullscreen mode" role="button" tabindex="0"><span class="ap-tooltip">Fullscreen (f)</span></span></div>`, 18),
    _tmpl$7$1 = /*#__PURE__*/template(`<span class="ap-marker-container ap-tooltip-container"><span class="ap-marker"></span><span class="ap-tooltip"></span></span>`, 6);
  function formatTime(seconds) {
    let s = Math.floor(seconds);
    const d = Math.floor(s / 86400);
    s %= 86400;
    const h = Math.floor(s / 3600);
    s %= 3600;
    const m = Math.floor(s / 60);
    s %= 60;
    if (d > 0) {
      return `${zeroPad(d)}:${zeroPad(h)}:${zeroPad(m)}:${zeroPad(s)}`;
    } else if (h > 0) {
      return `${zeroPad(h)}:${zeroPad(m)}:${zeroPad(s)}`;
    } else {
      return `${zeroPad(m)}:${zeroPad(s)}`;
    }
  }
  function zeroPad(n) {
    return n < 10 ? `0${n}` : n.toString();
  }
  var ControlBar = (props => {
    const e = f => {
      return e => {
        e.preventDefault();
        f(e);
      };
    };
    const currentTime = () => typeof props.currentTime === "number" ? formatTime(props.currentTime) : "--:--";
    const remainingTime = () => typeof props.remainingTime === "number" ? "-" + formatTime(props.remainingTime) : currentTime();
    const markers = createMemo(() => typeof props.duration === "number" ? props.markers.filter(m => m[0] < props.duration) : []);
    const markerPosition = m => `${m[0] / props.duration * 100}%`;
    const markerText = m => {
      if (m[1] === "") {
        return formatTime(m[0]);
      } else {
        return `${formatTime(m[0])} - ${m[1]}`;
      }
    };
    const isPastMarker = m => typeof props.currentTime === "number" ? m[0] <= props.currentTime : false;
    const gutterBarStyle = () => {
      return {
        transform: `scaleX(${props.progress || 0}`
      };
    };
    const calcPosition = e => {
      const barWidth = e.currentTarget.offsetWidth;
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const pos = Math.max(0, mouseX / barWidth);
      return `${pos * 100}%`;
    };
    const [mouseDown, setMouseDown] = createSignal(false);
    const throttledSeek = throttle(props.onSeekClick, 50);
    const onMouseDown = e => {
      if (e._marker) return;
      if (e.altKey || e.shiftKey || e.metaKey || e.ctrlKey || e.button !== 0) return;
      setMouseDown(true);
      props.onSeekClick(calcPosition(e));
    };
    const seekToMarker = index => {
      return e(() => {
        props.onSeekClick({
          marker: index
        });
      });
    };
    const onMove = e => {
      if (e.altKey || e.shiftKey || e.metaKey || e.ctrlKey) return;
      if (mouseDown()) {
        throttledSeek(calcPosition(e));
      }
    };
    const onDocumentMouseUp = () => {
      setMouseDown(false);
    };
    document.addEventListener("mouseup", onDocumentMouseUp);
    onCleanup(() => {
      document.removeEventListener("mouseup", onDocumentMouseUp);
    });
    return (() => {
      const _el$ = _tmpl$6$1.cloneNode(true),
        _el$3 = _el$.firstChild,
        _el$4 = _el$3.firstChild,
        _el$5 = _el$4.nextSibling,
        _el$6 = _el$3.nextSibling,
        _el$13 = _el$6.nextSibling,
        _el$14 = _el$13.firstChild,
        _el$15 = _el$13.nextSibling,
        _el$16 = _el$15.firstChild;
      const _ref$ = props.ref;
      typeof _ref$ === "function" ? use(_ref$, _el$) : props.ref = _el$;
      insert(_el$, createComponent(Show, {
        get when() {
          return props.isPausable;
        },
        get children() {
          const _el$2 = _tmpl$$6.cloneNode(true);
          addEventListener(_el$2, "click", e(props.onPlayClick));
          insert(_el$2, createComponent(Switch, {
            get children() {
              return [createComponent(Match, {
                get when() {
                  return props.isPlaying;
                },
                get children() {
                  return createComponent(PauseIcon, {});
                }
              }), createComponent(Match, {
                when: true,
                get children() {
                  return createComponent(PlayIcon, {});
                }
              })];
            }
          }));
          return _el$2;
        }
      }), _el$3);
      insert(_el$4, currentTime);
      insert(_el$5, remainingTime);
      insert(_el$6, createComponent(Show, {
        get when() {
          return typeof props.progress === "number" || props.isSeekable;
        },
        get children() {
          const _el$7 = _tmpl$2$1.cloneNode(true),
            _el$8 = _el$7.firstChild,
            _el$9 = _el$8.nextSibling;
          _el$7.$$mousemove = onMove;
          _el$7.$$mousedown = onMouseDown;
          insert(_el$7, createComponent(For, {
            get each() {
              return markers();
            },
            children: (m, i) => (() => {
              const _el$17 = _tmpl$7$1.cloneNode(true),
                _el$18 = _el$17.firstChild,
                _el$19 = _el$18.nextSibling;
              _el$17.$$mousedown = e => {
                e._marker = true;
              };
              addEventListener(_el$17, "click", seekToMarker(i()));
              insert(_el$19, () => markerText(m));
              createRenderEffect(_p$ => {
                const _v$ = markerPosition(m),
                  _v$2 = !!isPastMarker(m);
                _v$ !== _p$._v$ && _el$17.style.setProperty("left", _p$._v$ = _v$);
                _v$2 !== _p$._v$2 && _el$18.classList.toggle("ap-marker-past", _p$._v$2 = _v$2);
                return _p$;
              }, {
                _v$: undefined,
                _v$2: undefined
              });
              return _el$17;
            })()
          }), null);
          createRenderEffect(_$p => style(_el$9, gutterBarStyle(), _$p));
          return _el$7;
        }
      }));
      insert(_el$, createComponent(Show, {
        get when() {
          return props.isMuted !== undefined;
        },
        get children() {
          const _el$10 = _tmpl$5$1.cloneNode(true);
          addEventListener(_el$10, "click", e(props.onMuteClick));
          insert(_el$10, createComponent(Switch, {
            get children() {
              return [createComponent(Match, {
                get when() {
                  return props.isMuted === true;
                },
                get children() {
                  return [createComponent(SpeakerOffIcon, {}), _tmpl$3$1.cloneNode(true)];
                }
              }), createComponent(Match, {
                get when() {
                  return props.isMuted === false;
                },
                get children() {
                  return [createComponent(SpeakerOnIcon, {}), _tmpl$4$1.cloneNode(true)];
                }
              })];
            }
          }));
          return _el$10;
        }
      }), _el$13);
      addEventListener(_el$13, "click", e(props.onHelpClick));
      insert(_el$13, createComponent(KeyboardIcon, {}), _el$14);
      addEventListener(_el$15, "click", e(props.onFullscreenClick));
      insert(_el$15, createComponent(ShrinkIcon, {}), _el$16);
      insert(_el$15, createComponent(ExpandIcon, {}), _el$16);
      createRenderEffect(() => _el$.classList.toggle("ap-seekable", !!props.isSeekable));
      return _el$;
    })();
  });
  delegateEvents(["click", "mousedown", "mousemove"]);

  const _tmpl$$5 = /*#__PURE__*/template(`<div class="ap-overlay ap-overlay-error"><span>💥</span></div>`, 4);
  var ErrorOverlay = (props => {
    return _tmpl$$5.cloneNode(true);
  });

  const _tmpl$$4 = /*#__PURE__*/template(`<div class="ap-overlay ap-overlay-loading"><span class="ap-loader"></span></div>`, 4);
  var LoaderOverlay = (props => {
    return _tmpl$$4.cloneNode(true);
  });

  const _tmpl$$3 = /*#__PURE__*/template(`<div class="ap-overlay ap-overlay-info"><span></span></div>`, 4);
  var InfoOverlay = (props => {
    return (() => {
      const _el$ = _tmpl$$3.cloneNode(true),
        _el$2 = _el$.firstChild;
      insert(_el$2, () => props.message);
      createRenderEffect(() => _el$.classList.toggle("ap-was-playing", !!props.wasPlaying));
      return _el$;
    })();
  });

  const _tmpl$$2 = /*#__PURE__*/template(`<div class="ap-overlay ap-overlay-start"><div class="ap-play-button"><div><span><svg version="1.1" viewBox="0 0 1000.0 1000.0" class="ap-icon"><defs><mask id="small-triangle-mask"><rect width="100%" height="100%" fill="white"></rect><polygon points="700.0 500.0, 400.00000000000006 326.7949192431122, 399.9999999999999 673.2050807568877" fill="black"></polygon></mask></defs><polygon points="1000.0 500.0, 250.0000000000001 66.98729810778059, 249.99999999999977 933.0127018922192" mask="url(#small-triangle-mask)" fill="white" class="ap-play-btn-fill"></polygon><polyline points="673.2050807568878 400.0, 326.7949192431123 600.0" stroke="white" stroke-width="90" class="ap-play-btn-stroke"></polyline></svg></span></div></div></div>`, 22);
  var StartOverlay = (props => {
    const e = f => {
      return e => {
        e.preventDefault();
        f(e);
      };
    };
    return (() => {
      const _el$ = _tmpl$$2.cloneNode(true);
      addEventListener(_el$, "click", e(props.onClick));
      return _el$;
    })();
  });
  delegateEvents(["click"]);

  const _tmpl$$1 = /*#__PURE__*/template(`<li><kbd>space</kbd> - pause / resume</li>`, 4),
    _tmpl$2 = /*#__PURE__*/template(`<li><kbd>←</kbd> / <kbd>→</kbd> - rewind / fast-forward by 5 seconds</li>`, 6),
    _tmpl$3 = /*#__PURE__*/template(`<li><kbd>Shift</kbd> + <kbd>←</kbd> / <kbd>→</kbd> - rewind / fast-forward by 10%</li>`, 8),
    _tmpl$4 = /*#__PURE__*/template(`<li><kbd>[</kbd> / <kbd>]</kbd> - jump to the previous / next marker</li>`, 6),
    _tmpl$5 = /*#__PURE__*/template(`<li><kbd>0</kbd>, <kbd>1</kbd>, <kbd>2</kbd> ... <kbd>9</kbd> - jump to 0%, 10%, 20% ... 90%</li>`, 10),
    _tmpl$6 = /*#__PURE__*/template(`<li><kbd>,</kbd> / <kbd>.</kbd> - step back / forward, a frame at a time (when paused)</li>`, 6),
    _tmpl$7 = /*#__PURE__*/template(`<li><kbd>m</kbd> - mute / unmute audio</li>`, 4),
    _tmpl$8 = /*#__PURE__*/template(`<div class="ap-overlay ap-overlay-help"><div><div><p>Keyboard shortcuts</p><ul><li><kbd>f</kbd> - toggle fullscreen mode</li><li><kbd>?</kbd> - show this help popup</li></ul></div></div></div>`, 18);
  var HelpOverlay = (props => {
    const e = f => {
      return e => {
        e.preventDefault();
        f(e);
      };
    };
    return (() => {
      const _el$ = _tmpl$8.cloneNode(true),
        _el$2 = _el$.firstChild,
        _el$3 = _el$2.firstChild,
        _el$4 = _el$3.firstChild,
        _el$5 = _el$4.nextSibling,
        _el$12 = _el$5.firstChild,
        _el$14 = _el$12.nextSibling;
      addEventListener(_el$, "click", e(props.onClose));
      _el$2.$$click = e => {
        e.stopPropagation();
      };
      insert(_el$5, createComponent(Show, {
        get when() {
          return props.isPausable;
        },
        get children() {
          return _tmpl$$1.cloneNode(true);
        }
      }), _el$12);
      insert(_el$5, createComponent(Show, {
        get when() {
          return props.isSeekable;
        },
        get children() {
          return [_tmpl$2.cloneNode(true), _tmpl$3.cloneNode(true), _tmpl$4.cloneNode(true), _tmpl$5.cloneNode(true), _tmpl$6.cloneNode(true)];
        }
      }), _el$12);
      insert(_el$5, createComponent(Show, {
        get when() {
          return props.hasAudio;
        },
        get children() {
          return _tmpl$7.cloneNode(true);
        }
      }), _el$14);
      return _el$;
    })();
  });
  delegateEvents(["click"]);

  const _tmpl$ = /*#__PURE__*/template(`<div class="ap-wrapper" tabindex="-1"><div></div></div>`, 4);
  const CONTROL_BAR_HEIGHT = 32; // must match height of div.ap-control-bar in CSS

  var Player = (props => {
    const logger = props.logger;
    const core = props.core;
    const autoPlay = props.autoPlay;
    const [state, setState] = createStore({
      lines: [],
      cursor: undefined,
      charW: props.charW,
      charH: props.charH,
      bordersW: props.bordersW,
      bordersH: props.bordersH,
      containerW: 0,
      containerH: 0,
      isPausable: true,
      isSeekable: true,
      isFullscreen: false,
      currentTime: null,
      remainingTime: null,
      progress: null,
      blink: true,
      cursorHold: false
    });
    const [isPlaying, setIsPlaying] = createSignal(false);
    const [isMuted, setIsMuted] = createSignal(undefined);
    const [wasPlaying, setWasPlaying] = createSignal(false);
    const [overlay, setOverlay] = createSignal(!autoPlay ? "start" : null);
    const [infoMessage, setInfoMessage] = createSignal(null);
    const [terminalSize, setTerminalSize] = createSignal({
      cols: props.cols,
      rows: props.rows
    }, {
      equals: (newVal, oldVal) => newVal.cols === oldVal.cols && newVal.rows === oldVal.rows
    });
    const [duration, setDuration] = createSignal(undefined);
    const [markers, setMarkers] = createStore([]);
    const [userActive, setUserActive] = createSignal(false);
    const [isHelpVisible, setIsHelpVisible] = createSignal(false);
    const [originalTheme, setOriginalTheme] = createSignal(undefined);
    const terminalCols = createMemo(() => terminalSize().cols || 80);
    const terminalRows = createMemo(() => terminalSize().rows || 24);
    const controlBarHeight = () => props.controls === false ? 0 : CONTROL_BAR_HEIGHT;
    const controlsVisible = () => props.controls === true || props.controls === "auto" && userActive();
    let frameRequestId;
    let userActivityTimeoutId;
    let timeUpdateIntervalId;
    let blinkIntervalId;
    let wrapperRef;
    let playerRef;
    let terminalRef;
    let controlBarRef;
    let resizeObserver;
    function onPlaying() {
      updateTerminal();
      startBlinking();
      startTimeUpdates();
    }
    function onStopped() {
      stopBlinking();
      stopTimeUpdates();
      updateTime();
    }
    function resize(size_) {
      batch(() => {
        if (size_.rows < terminalSize().rows) {
          setState("lines", state.lines.slice(0, size_.rows));
        }
        setTerminalSize(size_);
      });
    }
    function setPoster(poster) {
      if (poster !== null && !autoPlay) {
        setState({
          lines: poster.lines,
          cursor: poster.cursor
        });
      }
    }
    let resolveCoreReady;
    const coreReady = new Promise(resolve => {
      resolveCoreReady = resolve;
    });
    core.addEventListener("ready", _ref => {
      let {
        isPausable,
        isSeekable,
        poster
      } = _ref;
      setState({
        isPausable,
        isSeekable
      });
      setPoster(poster);
      resolveCoreReady();
    });
    core.addEventListener("metadata", _ref2 => {
      let {
        cols,
        rows,
        duration,
        theme,
        poster,
        markers,
        hasAudio
      } = _ref2;
      batch(() => {
        resize({
          cols,
          rows
        });
        setDuration(duration);
        setOriginalTheme(theme);
        setMarkers(markers);
        setPoster(poster);
        setIsMuted(hasAudio ? false : undefined);
      });
    });
    core.addEventListener("play", () => {
      setOverlay(null);
    });
    core.addEventListener("playing", () => {
      batch(() => {
        setIsPlaying(true);
        setWasPlaying(true);
        setOverlay(null);
        onPlaying();
      });
    });
    core.addEventListener("idle", () => {
      batch(() => {
        setIsPlaying(false);
        onStopped();
      });
    });
    core.addEventListener("loading", () => {
      batch(() => {
        setIsPlaying(false);
        onStopped();
        setOverlay("loader");
      });
    });
    core.addEventListener("offline", _ref3 => {
      let {
        message
      } = _ref3;
      batch(() => {
        setIsPlaying(false);
        onStopped();
        if (message !== undefined) {
          setInfoMessage(message);
          setOverlay("info");
        }
      });
    });
    core.addEventListener("muted", muted => {
      setIsMuted(muted);
    });
    let renderCount = 0;
    core.addEventListener("ended", _ref4 => {
      let {
        message
      } = _ref4;
      batch(() => {
        setIsPlaying(false);
        onStopped();
        if (message !== undefined) {
          setInfoMessage(message);
          setOverlay("info");
        }
      });
      logger.debug(`view: render count: ${renderCount}`);
    });
    core.addEventListener("errored", () => {
      setOverlay("error");
    });
    core.addEventListener("resize", resize);
    core.addEventListener("reset", _ref5 => {
      let {
        cols,
        rows,
        theme
      } = _ref5;
      batch(() => {
        resize({
          cols,
          rows
        });
        setOriginalTheme(theme);
        updateTerminal();
      });
    });
    core.addEventListener("seeked", () => {
      updateTime();
    });
    core.addEventListener("terminalUpdate", () => {
      if (frameRequestId === undefined) {
        frameRequestId = requestAnimationFrame(updateTerminal);
      }
    });
    const setupResizeObserver = () => {
      resizeObserver = new ResizeObserver(debounce(_entries => {
        setState({
          containerW: wrapperRef.offsetWidth,
          containerH: wrapperRef.offsetHeight
        });
        wrapperRef.dispatchEvent(new CustomEvent("resize", {
          detail: {
            el: playerRef
          }
        }));
      }, 10));
      resizeObserver.observe(wrapperRef);
    };
    onMount(async () => {
      logger.info("view: mounted");
      logger.debug("view: font measurements", {
        charW: state.charW,
        charH: state.charH
      });
      setupResizeObserver();
      setState({
        containerW: wrapperRef.offsetWidth,
        containerH: wrapperRef.offsetHeight
      });
    });
    onCleanup(() => {
      core.stop();
      stopBlinking();
      stopTimeUpdates();
      resizeObserver.disconnect();
    });
    const updateTerminal = async () => {
      const changes = await core.getChanges();
      batch(() => {
        if (changes.lines !== undefined) {
          changes.lines.forEach((line, i) => {
            setState("lines", i, reconcile(line));
          });
        }
        if (changes.cursor !== undefined) {
          setState("cursor", reconcile(changes.cursor));
        }
        setState("cursorHold", true);
      });
      frameRequestId = undefined;
      renderCount += 1;
    };
    const terminalElementSize = createMemo(() => {
      const terminalW = state.charW * terminalCols() + state.bordersW;
      const terminalH = state.charH * terminalRows() + state.bordersH;
      let fit = props.fit ?? "width";
      if (fit === "both" || state.isFullscreen) {
        const containerRatio = state.containerW / (state.containerH - controlBarHeight());
        const terminalRatio = terminalW / terminalH;
        if (containerRatio > terminalRatio) {
          fit = "height";
        } else {
          fit = "width";
        }
      }
      if (fit === false || fit === "none") {
        return {};
      } else if (fit === "width") {
        const scale = state.containerW / terminalW;
        return {
          scale: scale,
          width: state.containerW,
          height: terminalH * scale + controlBarHeight()
        };
      } else if (fit === "height") {
        const scale = (state.containerH - controlBarHeight()) / terminalH;
        return {
          scale: scale,
          width: terminalW * scale,
          height: state.containerH
        };
      } else {
        throw `unsupported fit mode: ${fit}`;
      }
    });
    const onFullscreenChange = () => {
      setState("isFullscreen", document.fullscreenElement ?? document.webkitFullscreenElement);
    };
    const toggleFullscreen = () => {
      if (state.isFullscreen) {
        (document.exitFullscreen ?? document.webkitExitFullscreen ?? (() => {})).apply(document);
      } else {
        (wrapperRef.requestFullscreen ?? wrapperRef.webkitRequestFullscreen ?? (() => {})).apply(wrapperRef);
      }
    };
    const toggleHelp = () => {
      if (isHelpVisible()) {
        setIsHelpVisible(false);
      } else {
        core.pause();
        setIsHelpVisible(true);
      }
    };
    const onKeyDown = e => {
      if (e.altKey || e.metaKey || e.ctrlKey) {
        return;
      }
      if (e.key == " ") {
        core.togglePlay();
      } else if (e.key == ",") {
        core.step(-1).then(updateTime);
      } else if (e.key == ".") {
        core.step().then(updateTime);
      } else if (e.key == "f") {
        toggleFullscreen();
      } else if (e.key == "m") {
        toggleMuted();
      } else if (e.key == "[") {
        core.seek({
          marker: "prev"
        });
      } else if (e.key == "]") {
        core.seek({
          marker: "next"
        });
      } else if (e.key.charCodeAt(0) >= 48 && e.key.charCodeAt(0) <= 57) {
        const pos = (e.key.charCodeAt(0) - 48) / 10;
        core.seek(`${pos * 100}%`);
      } else if (e.key == "?") {
        toggleHelp();
      } else if (e.key == "ArrowLeft") {
        if (e.shiftKey) {
          core.seek("<<<");
        } else {
          core.seek("<<");
        }
      } else if (e.key == "ArrowRight") {
        if (e.shiftKey) {
          core.seek(">>>");
        } else {
          core.seek(">>");
        }
      } else if (e.key == "Escape") {
        setIsHelpVisible(false);
      } else {
        return;
      }
      e.stopPropagation();
      e.preventDefault();
    };
    const wrapperOnMouseMove = () => {
      if (state.isFullscreen) {
        onUserActive(true);
      }
    };
    const playerOnMouseLeave = () => {
      if (!state.isFullscreen) {
        onUserActive(false);
      }
    };
    const startTimeUpdates = () => {
      timeUpdateIntervalId = setInterval(updateTime, 100);
    };
    const stopTimeUpdates = () => {
      clearInterval(timeUpdateIntervalId);
    };
    const updateTime = async () => {
      const currentTime = await core.getCurrentTime();
      const remainingTime = await core.getRemainingTime();
      const progress = await core.getProgress();
      setState({
        currentTime,
        remainingTime,
        progress
      });
    };
    const startBlinking = () => {
      blinkIntervalId = setInterval(() => {
        setState(state => {
          const changes = {
            blink: !state.blink
          };
          if (changes.blink) {
            changes.cursorHold = false;
          }
          return changes;
        });
      }, 600);
    };
    const stopBlinking = () => {
      clearInterval(blinkIntervalId);
      setState("blink", true);
    };
    const onUserActive = show => {
      clearTimeout(userActivityTimeoutId);
      if (show) {
        userActivityTimeoutId = setTimeout(() => onUserActive(false), 2000);
      }
      setUserActive(show);
    };
    const theme = createMemo(() => {
      const name = props.theme || "auto/asciinema";
      if (name.slice(0, 5) === "auto/") {
        return {
          name: name.slice(5),
          colors: originalTheme()
        };
      } else {
        return {
          name
        };
      }
    });
    const playerStyle = () => {
      const style = {};
      if ((props.fit === false || props.fit === "none") && props.terminalFontSize !== undefined) {
        if (props.terminalFontSize === "small") {
          style["font-size"] = "12px";
        } else if (props.terminalFontSize === "medium") {
          style["font-size"] = "18px";
        } else if (props.terminalFontSize === "big") {
          style["font-size"] = "24px";
        } else {
          style["font-size"] = props.terminalFontSize;
        }
      }
      const size = terminalElementSize();
      if (size.width !== undefined) {
        style["width"] = `${size.width}px`;
        style["height"] = `${size.height}px`;
      }
      if (props.terminalFontFamily !== undefined) {
        style["--term-font-family"] = props.terminalFontFamily;
      }
      const themeColors = theme().colors;
      if (themeColors) {
        style["--term-color-foreground"] = themeColors.foreground;
        style["--term-color-background"] = themeColors.background;
        themeColors.palette.forEach((color, i) => {
          style[`--term-color-${i}`] = color;
        });
      }
      return style;
    };
    const play = () => {
      coreReady.then(() => core.play());
    };
    const togglePlay = () => {
      coreReady.then(() => core.togglePlay());
    };
    const toggleMuted = () => {
      coreReady.then(() => {
        if (isMuted() === true) {
          core.unmute();
        } else {
          core.mute();
        }
      });
    };
    const seek = pos => {
      coreReady.then(() => core.seek(pos));
    };
    const playerClass = () => `ap-player ap-default-term-ff asciinema-player-theme-${theme().name}`;
    const terminalScale = () => terminalElementSize()?.scale;
    const el = (() => {
      const _el$ = _tmpl$.cloneNode(true),
        _el$2 = _el$.firstChild;
      const _ref$ = wrapperRef;
      typeof _ref$ === "function" ? use(_ref$, _el$) : wrapperRef = _el$;
      _el$.addEventListener("webkitfullscreenchange", onFullscreenChange);
      _el$.addEventListener("fullscreenchange", onFullscreenChange);
      _el$.$$mousemove = wrapperOnMouseMove;
      _el$.$$keydown = onKeyDown;
      const _ref$2 = playerRef;
      typeof _ref$2 === "function" ? use(_ref$2, _el$2) : playerRef = _el$2;
      _el$2.$$mousemove = () => onUserActive(true);
      _el$2.addEventListener("mouseleave", playerOnMouseLeave);
      insert(_el$2, createComponent(Terminal, {
        get cols() {
          return terminalCols();
        },
        get rows() {
          return terminalRows();
        },
        get scale() {
          return terminalScale();
        },
        get blink() {
          return state.blink;
        },
        get lines() {
          return state.lines;
        },
        get cursor() {
          return state.cursor;
        },
        get cursorHold() {
          return state.cursorHold;
        },
        get lineHeight() {
          return props.terminalLineHeight;
        },
        ref(r$) {
          const _ref$3 = terminalRef;
          typeof _ref$3 === "function" ? _ref$3(r$) : terminalRef = r$;
        }
      }), null);
      insert(_el$2, createComponent(Show, {
        get when() {
          return props.controls !== false;
        },
        get children() {
          return createComponent(ControlBar, {
            get duration() {
              return duration();
            },
            get currentTime() {
              return state.currentTime;
            },
            get remainingTime() {
              return state.remainingTime;
            },
            get progress() {
              return state.progress;
            },
            markers: markers,
            get isPlaying() {
              return isPlaying() || overlay() == "loader";
            },
            get isPausable() {
              return state.isPausable;
            },
            get isSeekable() {
              return state.isSeekable;
            },
            get isMuted() {
              return isMuted();
            },
            onPlayClick: togglePlay,
            onFullscreenClick: toggleFullscreen,
            onHelpClick: toggleHelp,
            onSeekClick: seek,
            onMuteClick: toggleMuted,
            ref(r$) {
              const _ref$4 = controlBarRef;
              typeof _ref$4 === "function" ? _ref$4(r$) : controlBarRef = r$;
            }
          });
        }
      }), null);
      insert(_el$2, createComponent(Switch, {
        get children() {
          return [createComponent(Match, {
            get when() {
              return overlay() == "start";
            },
            get children() {
              return createComponent(StartOverlay, {
                onClick: play
              });
            }
          }), createComponent(Match, {
            get when() {
              return overlay() == "loader";
            },
            get children() {
              return createComponent(LoaderOverlay, {});
            }
          }), createComponent(Match, {
            get when() {
              return overlay() == "error";
            },
            get children() {
              return createComponent(ErrorOverlay, {});
            }
          })];
        }
      }), null);
      insert(_el$2, createComponent(Transition, {
        name: "slide",
        get children() {
          return createComponent(Show, {
            get when() {
              return overlay() == "info";
            },
            get children() {
              return createComponent(InfoOverlay, {
                get message() {
                  return infoMessage();
                },
                get wasPlaying() {
                  return wasPlaying();
                }
              });
            }
          });
        }
      }), null);
      insert(_el$2, createComponent(Show, {
        get when() {
          return isHelpVisible();
        },
        get children() {
          return createComponent(HelpOverlay, {
            onClose: () => setIsHelpVisible(false),
            get isPausable() {
              return state.isPausable;
            },
            get isSeekable() {
              return state.isSeekable;
            },
            get hasAudio() {
              return isMuted() !== undefined;
            }
          });
        }
      }), null);
      createRenderEffect(_p$ => {
        const _v$ = !!controlsVisible(),
          _v$2 = playerClass(),
          _v$3 = playerStyle();
        _v$ !== _p$._v$ && _el$.classList.toggle("ap-hud", _p$._v$ = _v$);
        _v$2 !== _p$._v$2 && className(_el$2, _p$._v$2 = _v$2);
        _p$._v$3 = style(_el$2, _v$3, _p$._v$3);
        return _p$;
      }, {
        _v$: undefined,
        _v$2: undefined,
        _v$3: undefined
      });
      return _el$;
    })();
    return el;
  });
  delegateEvents(["keydown", "mousemove"]);

  function mount(core, elem) {
    let opts = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    const metrics = measureTerminal(opts.terminalFontFamily, opts.terminalLineHeight);
    const props = {
      core: core,
      logger: opts.logger,
      cols: opts.cols,
      rows: opts.rows,
      fit: opts.fit,
      controls: opts.controls,
      autoPlay: opts.autoPlay,
      terminalFontSize: opts.terminalFontSize,
      terminalFontFamily: opts.terminalFontFamily,
      terminalLineHeight: opts.terminalLineHeight,
      theme: opts.theme,
      ...metrics
    };
    let el;
    const dispose = render(() => {
      el = createComponent(Player, props);
      return el;
    }, elem);
    return {
      el: el,
      dispose: dispose
    };
  }
  function measureTerminal(fontFamily, lineHeight) {
    const cols = 80;
    const rows = 24;
    const div = document.createElement("div");
    div.className = "ap-default-term-ff";
    div.style.height = "0px";
    div.style.overflow = "hidden";
    div.style.fontSize = "15px"; // must match font-size of div.asciinema-player in CSS

    if (fontFamily !== undefined) {
      div.style.setProperty("--term-font-family", fontFamily);
    }
    document.body.appendChild(div);
    let el;
    const dispose = render(() => {
      el = createComponent(Terminal, {
        cols: cols,
        rows: rows,
        lineHeight: lineHeight,
        lines: []
      });
      return el;
    }, div);
    const metrics = {
      charW: el.clientWidth / cols,
      charH: el.clientHeight / rows,
      bordersW: el.offsetWidth - el.clientWidth,
      bordersH: el.offsetHeight - el.clientHeight
    };
    dispose();
    document.body.removeChild(div);
    return metrics;
  }

  const CORE_OPTS = ['autoPlay', 'autoplay', 'cols', 'idleTimeLimit', 'loop', 'markers', 'pauseOnMarkers', 'poster', 'preload', 'rows', 'speed', 'startAt', 'audioUrl'];
  const UI_OPTS = ['autoPlay', 'autoplay', 'cols', 'controls', 'fit', 'rows', 'terminalFontFamily', 'terminalFontSize', 'terminalLineHeight', 'theme'];
  function coreOpts(inputOpts) {
    let overrides = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    const opts = Object.fromEntries(Object.entries(inputOpts).filter(_ref => {
      let [key] = _ref;
      return CORE_OPTS.includes(key);
    }));
    opts.autoPlay ??= opts.autoplay;
    opts.speed ??= 1.0;
    return {
      ...opts,
      ...overrides
    };
  }
  function uiOpts(inputOpts) {
    let overrides = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    const opts = Object.fromEntries(Object.entries(inputOpts).filter(_ref2 => {
      let [key] = _ref2;
      return UI_OPTS.includes(key);
    }));
    opts.autoPlay ??= opts.autoplay;
    opts.controls ??= "auto";
    return {
      ...opts,
      ...overrides
    };
  }

  function create(src, elem) {
    let opts = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    const logger = opts.logger ?? new DummyLogger();
    const core = new Core(src, coreOpts(opts, {
      logger
    }));
    const {
      el,
      dispose
    } = mount(core, elem, uiOpts(opts, {
      logger
    }));
    const ready = core.init();
    const player = {
      el,
      dispose,
      getCurrentTime: () => ready.then(core.getCurrentTime.bind(core)),
      getDuration: () => ready.then(core.getDuration.bind(core)),
      play: () => ready.then(core.play.bind(core)),
      pause: () => ready.then(core.pause.bind(core)),
      seek: pos => ready.then(() => core.seek(pos))
    };
    player.addEventListener = (name, callback) => {
      return core.addEventListener(name, callback.bind(player));
    };
    return player;
  }

  exports.create = create;

  return exports;

})({});
