#!/usr/bin/env node
import { createRequire } from "node:module"; const require = createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x3) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x3, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x3)(function(x3) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x3 + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/ajv/dist/compile/codegen/code.js
var require_code = __commonJS({
  "node_modules/ajv/dist/compile/codegen/code.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.regexpCode = exports.getEsmExportName = exports.getProperty = exports.safeStringify = exports.stringify = exports.strConcat = exports.addCodeArg = exports.str = exports._ = exports.nil = exports._Code = exports.Name = exports.IDENTIFIER = exports._CodeOrName = void 0;
    var _CodeOrName = class {
    };
    exports._CodeOrName = _CodeOrName;
    exports.IDENTIFIER = /^[a-z$_][a-z$_0-9]*$/i;
    var Name = class extends _CodeOrName {
      constructor(s) {
        super();
        if (!exports.IDENTIFIER.test(s))
          throw new Error("CodeGen: name must be a valid identifier");
        this.str = s;
      }
      toString() {
        return this.str;
      }
      emptyStr() {
        return false;
      }
      get names() {
        return { [this.str]: 1 };
      }
    };
    exports.Name = Name;
    var _Code = class extends _CodeOrName {
      constructor(code) {
        super();
        this._items = typeof code === "string" ? [code] : code;
      }
      toString() {
        return this.str;
      }
      emptyStr() {
        if (this._items.length > 1)
          return false;
        const item = this._items[0];
        return item === "" || item === '""';
      }
      get str() {
        var _a;
        return (_a = this._str) !== null && _a !== void 0 ? _a : this._str = this._items.reduce((s, c) => `${s}${c}`, "");
      }
      get names() {
        var _a;
        return (_a = this._names) !== null && _a !== void 0 ? _a : this._names = this._items.reduce((names, c) => {
          if (c instanceof Name)
            names[c.str] = (names[c.str] || 0) + 1;
          return names;
        }, {});
      }
    };
    exports._Code = _Code;
    exports.nil = new _Code("");
    function _2(strs, ...args) {
      const code = [strs[0]];
      let i = 0;
      while (i < args.length) {
        addCodeArg(code, args[i]);
        code.push(strs[++i]);
      }
      return new _Code(code);
    }
    exports._ = _2;
    var plus = new _Code("+");
    function str(strs, ...args) {
      const expr = [safeStringify(strs[0])];
      let i = 0;
      while (i < args.length) {
        expr.push(plus);
        addCodeArg(expr, args[i]);
        expr.push(plus, safeStringify(strs[++i]));
      }
      optimize(expr);
      return new _Code(expr);
    }
    exports.str = str;
    function addCodeArg(code, arg) {
      if (arg instanceof _Code)
        code.push(...arg._items);
      else if (arg instanceof Name)
        code.push(arg);
      else
        code.push(interpolate(arg));
    }
    exports.addCodeArg = addCodeArg;
    function optimize(expr) {
      let i = 1;
      while (i < expr.length - 1) {
        if (expr[i] === plus) {
          const res = mergeExprItems(expr[i - 1], expr[i + 1]);
          if (res !== void 0) {
            expr.splice(i - 1, 3, res);
            continue;
          }
          expr[i++] = "+";
        }
        i++;
      }
    }
    function mergeExprItems(a, b) {
      if (b === '""')
        return a;
      if (a === '""')
        return b;
      if (typeof a == "string") {
        if (b instanceof Name || a[a.length - 1] !== '"')
          return;
        if (typeof b != "string")
          return `${a.slice(0, -1)}${b}"`;
        if (b[0] === '"')
          return a.slice(0, -1) + b.slice(1);
        return;
      }
      if (typeof b == "string" && b[0] === '"' && !(a instanceof Name))
        return `"${a}${b.slice(1)}`;
      return;
    }
    function strConcat(c1, c2) {
      return c2.emptyStr() ? c1 : c1.emptyStr() ? c2 : str`${c1}${c2}`;
    }
    exports.strConcat = strConcat;
    function interpolate(x3) {
      return typeof x3 == "number" || typeof x3 == "boolean" || x3 === null ? x3 : safeStringify(Array.isArray(x3) ? x3.join(",") : x3);
    }
    function stringify2(x3) {
      return new _Code(safeStringify(x3));
    }
    exports.stringify = stringify2;
    function safeStringify(x3) {
      return JSON.stringify(x3).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
    }
    exports.safeStringify = safeStringify;
    function getProperty(key) {
      return typeof key == "string" && exports.IDENTIFIER.test(key) ? new _Code(`.${key}`) : _2`[${key}]`;
    }
    exports.getProperty = getProperty;
    function getEsmExportName(key) {
      if (typeof key == "string" && exports.IDENTIFIER.test(key)) {
        return new _Code(`${key}`);
      }
      throw new Error(`CodeGen: invalid export name: ${key}, use explicit $id name mapping`);
    }
    exports.getEsmExportName = getEsmExportName;
    function regexpCode(rx) {
      return new _Code(rx.toString());
    }
    exports.regexpCode = regexpCode;
  }
});

// node_modules/ajv/dist/compile/codegen/scope.js
var require_scope = __commonJS({
  "node_modules/ajv/dist/compile/codegen/scope.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ValueScope = exports.ValueScopeName = exports.Scope = exports.varKinds = exports.UsedValueState = void 0;
    var code_1 = require_code();
    var ValueError = class extends Error {
      constructor(name) {
        super(`CodeGen: "code" for ${name} not defined`);
        this.value = name.value;
      }
    };
    var UsedValueState;
    (function(UsedValueState2) {
      UsedValueState2[UsedValueState2["Started"] = 0] = "Started";
      UsedValueState2[UsedValueState2["Completed"] = 1] = "Completed";
    })(UsedValueState || (exports.UsedValueState = UsedValueState = {}));
    exports.varKinds = {
      const: new code_1.Name("const"),
      let: new code_1.Name("let"),
      var: new code_1.Name("var")
    };
    var Scope = class {
      constructor({ prefixes, parent } = {}) {
        this._names = {};
        this._prefixes = prefixes;
        this._parent = parent;
      }
      toName(nameOrPrefix) {
        return nameOrPrefix instanceof code_1.Name ? nameOrPrefix : this.name(nameOrPrefix);
      }
      name(prefix) {
        return new code_1.Name(this._newName(prefix));
      }
      _newName(prefix) {
        const ng = this._names[prefix] || this._nameGroup(prefix);
        return `${prefix}${ng.index++}`;
      }
      _nameGroup(prefix) {
        var _a, _b;
        if (((_b = (_a = this._parent) === null || _a === void 0 ? void 0 : _a._prefixes) === null || _b === void 0 ? void 0 : _b.has(prefix)) || this._prefixes && !this._prefixes.has(prefix)) {
          throw new Error(`CodeGen: prefix "${prefix}" is not allowed in this scope`);
        }
        return this._names[prefix] = { prefix, index: 0 };
      }
    };
    exports.Scope = Scope;
    var ValueScopeName = class extends code_1.Name {
      constructor(prefix, nameStr) {
        super(nameStr);
        this.prefix = prefix;
      }
      setValue(value, { property, itemIndex }) {
        this.value = value;
        this.scopePath = (0, code_1._)`.${new code_1.Name(property)}[${itemIndex}]`;
      }
    };
    exports.ValueScopeName = ValueScopeName;
    var line = (0, code_1._)`\n`;
    var ValueScope = class extends Scope {
      constructor(opts) {
        super(opts);
        this._values = {};
        this._scope = opts.scope;
        this.opts = { ...opts, _n: opts.lines ? line : code_1.nil };
      }
      get() {
        return this._scope;
      }
      name(prefix) {
        return new ValueScopeName(prefix, this._newName(prefix));
      }
      value(nameOrPrefix, value) {
        var _a;
        if (value.ref === void 0)
          throw new Error("CodeGen: ref must be passed in value");
        const name = this.toName(nameOrPrefix);
        const { prefix } = name;
        const valueKey = (_a = value.key) !== null && _a !== void 0 ? _a : value.ref;
        let vs = this._values[prefix];
        if (vs) {
          const _name = vs.get(valueKey);
          if (_name)
            return _name;
        } else {
          vs = this._values[prefix] = /* @__PURE__ */ new Map();
        }
        vs.set(valueKey, name);
        const s = this._scope[prefix] || (this._scope[prefix] = []);
        const itemIndex = s.length;
        s[itemIndex] = value.ref;
        name.setValue(value, { property: prefix, itemIndex });
        return name;
      }
      getValue(prefix, keyOrRef) {
        const vs = this._values[prefix];
        if (!vs)
          return;
        return vs.get(keyOrRef);
      }
      scopeRefs(scopeName, values = this._values) {
        return this._reduceValues(values, (name) => {
          if (name.scopePath === void 0)
            throw new Error(`CodeGen: name "${name}" has no value`);
          return (0, code_1._)`${scopeName}${name.scopePath}`;
        });
      }
      scopeCode(values = this._values, usedValues, getCode) {
        return this._reduceValues(values, (name) => {
          if (name.value === void 0)
            throw new Error(`CodeGen: name "${name}" has no value`);
          return name.value.code;
        }, usedValues, getCode);
      }
      _reduceValues(values, valueCode, usedValues = {}, getCode) {
        let code = code_1.nil;
        for (const prefix in values) {
          const vs = values[prefix];
          if (!vs)
            continue;
          const nameSet = usedValues[prefix] = usedValues[prefix] || /* @__PURE__ */ new Map();
          vs.forEach((name) => {
            if (nameSet.has(name))
              return;
            nameSet.set(name, UsedValueState.Started);
            let c = valueCode(name);
            if (c) {
              const def = this.opts.es5 ? exports.varKinds.var : exports.varKinds.const;
              code = (0, code_1._)`${code}${def} ${name} = ${c};${this.opts._n}`;
            } else if (c = getCode === null || getCode === void 0 ? void 0 : getCode(name)) {
              code = (0, code_1._)`${code}${c}${this.opts._n}`;
            } else {
              throw new ValueError(name);
            }
            nameSet.set(name, UsedValueState.Completed);
          });
        }
        return code;
      }
    };
    exports.ValueScope = ValueScope;
  }
});

// node_modules/ajv/dist/compile/codegen/index.js
var require_codegen = __commonJS({
  "node_modules/ajv/dist/compile/codegen/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.or = exports.and = exports.not = exports.CodeGen = exports.operators = exports.varKinds = exports.ValueScopeName = exports.ValueScope = exports.Scope = exports.Name = exports.regexpCode = exports.stringify = exports.getProperty = exports.nil = exports.strConcat = exports.str = exports._ = void 0;
    var code_1 = require_code();
    var scope_1 = require_scope();
    var code_2 = require_code();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return code_2._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return code_2.str;
    } });
    Object.defineProperty(exports, "strConcat", { enumerable: true, get: function() {
      return code_2.strConcat;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return code_2.nil;
    } });
    Object.defineProperty(exports, "getProperty", { enumerable: true, get: function() {
      return code_2.getProperty;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return code_2.stringify;
    } });
    Object.defineProperty(exports, "regexpCode", { enumerable: true, get: function() {
      return code_2.regexpCode;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return code_2.Name;
    } });
    var scope_2 = require_scope();
    Object.defineProperty(exports, "Scope", { enumerable: true, get: function() {
      return scope_2.Scope;
    } });
    Object.defineProperty(exports, "ValueScope", { enumerable: true, get: function() {
      return scope_2.ValueScope;
    } });
    Object.defineProperty(exports, "ValueScopeName", { enumerable: true, get: function() {
      return scope_2.ValueScopeName;
    } });
    Object.defineProperty(exports, "varKinds", { enumerable: true, get: function() {
      return scope_2.varKinds;
    } });
    exports.operators = {
      GT: new code_1._Code(">"),
      GTE: new code_1._Code(">="),
      LT: new code_1._Code("<"),
      LTE: new code_1._Code("<="),
      EQ: new code_1._Code("==="),
      NEQ: new code_1._Code("!=="),
      NOT: new code_1._Code("!"),
      OR: new code_1._Code("||"),
      AND: new code_1._Code("&&"),
      ADD: new code_1._Code("+")
    };
    var Node = class {
      optimizeNodes() {
        return this;
      }
      optimizeNames(_names, _constants) {
        return this;
      }
    };
    var Def = class extends Node {
      constructor(varKind, name, rhs) {
        super();
        this.varKind = varKind;
        this.name = name;
        this.rhs = rhs;
      }
      render({ es5, _n }) {
        const varKind = es5 ? scope_1.varKinds.var : this.varKind;
        const rhs = this.rhs === void 0 ? "" : ` = ${this.rhs}`;
        return `${varKind} ${this.name}${rhs};` + _n;
      }
      optimizeNames(names, constants3) {
        if (!names[this.name.str])
          return;
        if (this.rhs)
          this.rhs = optimizeExpr(this.rhs, names, constants3);
        return this;
      }
      get names() {
        return this.rhs instanceof code_1._CodeOrName ? this.rhs.names : {};
      }
    };
    var Assign = class extends Node {
      constructor(lhs, rhs, sideEffects) {
        super();
        this.lhs = lhs;
        this.rhs = rhs;
        this.sideEffects = sideEffects;
      }
      render({ _n }) {
        return `${this.lhs} = ${this.rhs};` + _n;
      }
      optimizeNames(names, constants3) {
        if (this.lhs instanceof code_1.Name && !names[this.lhs.str] && !this.sideEffects)
          return;
        this.rhs = optimizeExpr(this.rhs, names, constants3);
        return this;
      }
      get names() {
        const names = this.lhs instanceof code_1.Name ? {} : { ...this.lhs.names };
        return addExprNames(names, this.rhs);
      }
    };
    var AssignOp = class extends Assign {
      constructor(lhs, op, rhs, sideEffects) {
        super(lhs, rhs, sideEffects);
        this.op = op;
      }
      render({ _n }) {
        return `${this.lhs} ${this.op}= ${this.rhs};` + _n;
      }
    };
    var Label = class extends Node {
      constructor(label) {
        super();
        this.label = label;
        this.names = {};
      }
      render({ _n }) {
        return `${this.label}:` + _n;
      }
    };
    var Break = class extends Node {
      constructor(label) {
        super();
        this.label = label;
        this.names = {};
      }
      render({ _n }) {
        const label = this.label ? ` ${this.label}` : "";
        return `break${label};` + _n;
      }
    };
    var Throw = class extends Node {
      constructor(error) {
        super();
        this.error = error;
      }
      render({ _n }) {
        return `throw ${this.error};` + _n;
      }
      get names() {
        return this.error.names;
      }
    };
    var AnyCode = class extends Node {
      constructor(code) {
        super();
        this.code = code;
      }
      render({ _n }) {
        return `${this.code};` + _n;
      }
      optimizeNodes() {
        return `${this.code}` ? this : void 0;
      }
      optimizeNames(names, constants3) {
        this.code = optimizeExpr(this.code, names, constants3);
        return this;
      }
      get names() {
        return this.code instanceof code_1._CodeOrName ? this.code.names : {};
      }
    };
    var ParentNode = class extends Node {
      constructor(nodes = []) {
        super();
        this.nodes = nodes;
      }
      render(opts) {
        return this.nodes.reduce((code, n) => code + n.render(opts), "");
      }
      optimizeNodes() {
        const { nodes } = this;
        let i = nodes.length;
        while (i--) {
          const n = nodes[i].optimizeNodes();
          if (Array.isArray(n))
            nodes.splice(i, 1, ...n);
          else if (n)
            nodes[i] = n;
          else
            nodes.splice(i, 1);
        }
        return nodes.length > 0 ? this : void 0;
      }
      optimizeNames(names, constants3) {
        const { nodes } = this;
        let i = nodes.length;
        while (i--) {
          const n = nodes[i];
          if (n.optimizeNames(names, constants3))
            continue;
          subtractNames(names, n.names);
          nodes.splice(i, 1);
        }
        return nodes.length > 0 ? this : void 0;
      }
      get names() {
        return this.nodes.reduce((names, n) => addNames(names, n.names), {});
      }
    };
    var BlockNode = class extends ParentNode {
      render(opts) {
        return "{" + opts._n + super.render(opts) + "}" + opts._n;
      }
    };
    var Root = class extends ParentNode {
    };
    var Else = class extends BlockNode {
    };
    Else.kind = "else";
    var If = class _If extends BlockNode {
      constructor(condition, nodes) {
        super(nodes);
        this.condition = condition;
      }
      render(opts) {
        let code = `if(${this.condition})` + super.render(opts);
        if (this.else)
          code += "else " + this.else.render(opts);
        return code;
      }
      optimizeNodes() {
        super.optimizeNodes();
        const cond = this.condition;
        if (cond === true)
          return this.nodes;
        let e = this.else;
        if (e) {
          const ns = e.optimizeNodes();
          e = this.else = Array.isArray(ns) ? new Else(ns) : ns;
        }
        if (e) {
          if (cond === false)
            return e instanceof _If ? e : e.nodes;
          if (this.nodes.length)
            return this;
          return new _If(not(cond), e instanceof _If ? [e] : e.nodes);
        }
        if (cond === false || !this.nodes.length)
          return void 0;
        return this;
      }
      optimizeNames(names, constants3) {
        var _a;
        this.else = (_a = this.else) === null || _a === void 0 ? void 0 : _a.optimizeNames(names, constants3);
        if (!(super.optimizeNames(names, constants3) || this.else))
          return;
        this.condition = optimizeExpr(this.condition, names, constants3);
        return this;
      }
      get names() {
        const names = super.names;
        addExprNames(names, this.condition);
        if (this.else)
          addNames(names, this.else.names);
        return names;
      }
    };
    If.kind = "if";
    var For = class extends BlockNode {
    };
    For.kind = "for";
    var ForLoop = class extends For {
      constructor(iteration) {
        super();
        this.iteration = iteration;
      }
      render(opts) {
        return `for(${this.iteration})` + super.render(opts);
      }
      optimizeNames(names, constants3) {
        if (!super.optimizeNames(names, constants3))
          return;
        this.iteration = optimizeExpr(this.iteration, names, constants3);
        return this;
      }
      get names() {
        return addNames(super.names, this.iteration.names);
      }
    };
    var ForRange = class extends For {
      constructor(varKind, name, from, to) {
        super();
        this.varKind = varKind;
        this.name = name;
        this.from = from;
        this.to = to;
      }
      render(opts) {
        const varKind = opts.es5 ? scope_1.varKinds.var : this.varKind;
        const { name, from, to } = this;
        return `for(${varKind} ${name}=${from}; ${name}<${to}; ${name}++)` + super.render(opts);
      }
      get names() {
        const names = addExprNames(super.names, this.from);
        return addExprNames(names, this.to);
      }
    };
    var ForIter = class extends For {
      constructor(loop, varKind, name, iterable) {
        super();
        this.loop = loop;
        this.varKind = varKind;
        this.name = name;
        this.iterable = iterable;
      }
      render(opts) {
        return `for(${this.varKind} ${this.name} ${this.loop} ${this.iterable})` + super.render(opts);
      }
      optimizeNames(names, constants3) {
        if (!super.optimizeNames(names, constants3))
          return;
        this.iterable = optimizeExpr(this.iterable, names, constants3);
        return this;
      }
      get names() {
        return addNames(super.names, this.iterable.names);
      }
    };
    var Func = class extends BlockNode {
      constructor(name, args, async) {
        super();
        this.name = name;
        this.args = args;
        this.async = async;
      }
      render(opts) {
        const _async = this.async ? "async " : "";
        return `${_async}function ${this.name}(${this.args})` + super.render(opts);
      }
    };
    Func.kind = "func";
    var Return = class extends ParentNode {
      render(opts) {
        return "return " + super.render(opts);
      }
    };
    Return.kind = "return";
    var Try = class extends BlockNode {
      render(opts) {
        let code = "try" + super.render(opts);
        if (this.catch)
          code += this.catch.render(opts);
        if (this.finally)
          code += this.finally.render(opts);
        return code;
      }
      optimizeNodes() {
        var _a, _b;
        super.optimizeNodes();
        (_a = this.catch) === null || _a === void 0 ? void 0 : _a.optimizeNodes();
        (_b = this.finally) === null || _b === void 0 ? void 0 : _b.optimizeNodes();
        return this;
      }
      optimizeNames(names, constants3) {
        var _a, _b;
        super.optimizeNames(names, constants3);
        (_a = this.catch) === null || _a === void 0 ? void 0 : _a.optimizeNames(names, constants3);
        (_b = this.finally) === null || _b === void 0 ? void 0 : _b.optimizeNames(names, constants3);
        return this;
      }
      get names() {
        const names = super.names;
        if (this.catch)
          addNames(names, this.catch.names);
        if (this.finally)
          addNames(names, this.finally.names);
        return names;
      }
    };
    var Catch = class extends BlockNode {
      constructor(error) {
        super();
        this.error = error;
      }
      render(opts) {
        return `catch(${this.error})` + super.render(opts);
      }
    };
    Catch.kind = "catch";
    var Finally = class extends BlockNode {
      render(opts) {
        return "finally" + super.render(opts);
      }
    };
    Finally.kind = "finally";
    var CodeGen = class {
      constructor(extScope, opts = {}) {
        this._values = {};
        this._blockStarts = [];
        this._constants = {};
        this.opts = { ...opts, _n: opts.lines ? "\n" : "" };
        this._extScope = extScope;
        this._scope = new scope_1.Scope({ parent: extScope });
        this._nodes = [new Root()];
      }
      toString() {
        return this._root.render(this.opts);
      }
      // returns unique name in the internal scope
      name(prefix) {
        return this._scope.name(prefix);
      }
      // reserves unique name in the external scope
      scopeName(prefix) {
        return this._extScope.name(prefix);
      }
      // reserves unique name in the external scope and assigns value to it
      scopeValue(prefixOrName, value) {
        const name = this._extScope.value(prefixOrName, value);
        const vs = this._values[name.prefix] || (this._values[name.prefix] = /* @__PURE__ */ new Set());
        vs.add(name);
        return name;
      }
      getScopeValue(prefix, keyOrRef) {
        return this._extScope.getValue(prefix, keyOrRef);
      }
      // return code that assigns values in the external scope to the names that are used internally
      // (same names that were returned by gen.scopeName or gen.scopeValue)
      scopeRefs(scopeName) {
        return this._extScope.scopeRefs(scopeName, this._values);
      }
      scopeCode() {
        return this._extScope.scopeCode(this._values);
      }
      _def(varKind, nameOrPrefix, rhs, constant) {
        const name = this._scope.toName(nameOrPrefix);
        if (rhs !== void 0 && constant)
          this._constants[name.str] = rhs;
        this._leafNode(new Def(varKind, name, rhs));
        return name;
      }
      // `const` declaration (`var` in es5 mode)
      const(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.const, nameOrPrefix, rhs, _constant);
      }
      // `let` declaration with optional assignment (`var` in es5 mode)
      let(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.let, nameOrPrefix, rhs, _constant);
      }
      // `var` declaration with optional assignment
      var(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.var, nameOrPrefix, rhs, _constant);
      }
      // assignment code
      assign(lhs, rhs, sideEffects) {
        return this._leafNode(new Assign(lhs, rhs, sideEffects));
      }
      // `+=` code
      add(lhs, rhs) {
        return this._leafNode(new AssignOp(lhs, exports.operators.ADD, rhs));
      }
      // appends passed SafeExpr to code or executes Block
      code(c) {
        if (typeof c == "function")
          c();
        else if (c !== code_1.nil)
          this._leafNode(new AnyCode(c));
        return this;
      }
      // returns code for object literal for the passed argument list of key-value pairs
      object(...keyValues) {
        const code = ["{"];
        for (const [key, value] of keyValues) {
          if (code.length > 1)
            code.push(",");
          code.push(key);
          if (key !== value || this.opts.es5) {
            code.push(":");
            (0, code_1.addCodeArg)(code, value);
          }
        }
        code.push("}");
        return new code_1._Code(code);
      }
      // `if` clause (or statement if `thenBody` and, optionally, `elseBody` are passed)
      if(condition, thenBody, elseBody) {
        this._blockNode(new If(condition));
        if (thenBody && elseBody) {
          this.code(thenBody).else().code(elseBody).endIf();
        } else if (thenBody) {
          this.code(thenBody).endIf();
        } else if (elseBody) {
          throw new Error('CodeGen: "else" body without "then" body');
        }
        return this;
      }
      // `else if` clause - invalid without `if` or after `else` clauses
      elseIf(condition) {
        return this._elseNode(new If(condition));
      }
      // `else` clause - only valid after `if` or `else if` clauses
      else() {
        return this._elseNode(new Else());
      }
      // end `if` statement (needed if gen.if was used only with condition)
      endIf() {
        return this._endBlockNode(If, Else);
      }
      _for(node, forBody) {
        this._blockNode(node);
        if (forBody)
          this.code(forBody).endFor();
        return this;
      }
      // a generic `for` clause (or statement if `forBody` is passed)
      for(iteration, forBody) {
        return this._for(new ForLoop(iteration), forBody);
      }
      // `for` statement for a range of values
      forRange(nameOrPrefix, from, to, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.let) {
        const name = this._scope.toName(nameOrPrefix);
        return this._for(new ForRange(varKind, name, from, to), () => forBody(name));
      }
      // `for-of` statement (in es5 mode replace with a normal for loop)
      forOf(nameOrPrefix, iterable, forBody, varKind = scope_1.varKinds.const) {
        const name = this._scope.toName(nameOrPrefix);
        if (this.opts.es5) {
          const arr = iterable instanceof code_1.Name ? iterable : this.var("_arr", iterable);
          return this.forRange("_i", 0, (0, code_1._)`${arr}.length`, (i) => {
            this.var(name, (0, code_1._)`${arr}[${i}]`);
            forBody(name);
          });
        }
        return this._for(new ForIter("of", varKind, name, iterable), () => forBody(name));
      }
      // `for-in` statement.
      // With option `ownProperties` replaced with a `for-of` loop for object keys
      forIn(nameOrPrefix, obj, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.const) {
        if (this.opts.ownProperties) {
          return this.forOf(nameOrPrefix, (0, code_1._)`Object.keys(${obj})`, forBody);
        }
        const name = this._scope.toName(nameOrPrefix);
        return this._for(new ForIter("in", varKind, name, obj), () => forBody(name));
      }
      // end `for` loop
      endFor() {
        return this._endBlockNode(For);
      }
      // `label` statement
      label(label) {
        return this._leafNode(new Label(label));
      }
      // `break` statement
      break(label) {
        return this._leafNode(new Break(label));
      }
      // `return` statement
      return(value) {
        const node = new Return();
        this._blockNode(node);
        this.code(value);
        if (node.nodes.length !== 1)
          throw new Error('CodeGen: "return" should have one node');
        return this._endBlockNode(Return);
      }
      // `try` statement
      try(tryBody, catchCode, finallyCode) {
        if (!catchCode && !finallyCode)
          throw new Error('CodeGen: "try" without "catch" and "finally"');
        const node = new Try();
        this._blockNode(node);
        this.code(tryBody);
        if (catchCode) {
          const error = this.name("e");
          this._currNode = node.catch = new Catch(error);
          catchCode(error);
        }
        if (finallyCode) {
          this._currNode = node.finally = new Finally();
          this.code(finallyCode);
        }
        return this._endBlockNode(Catch, Finally);
      }
      // `throw` statement
      throw(error) {
        return this._leafNode(new Throw(error));
      }
      // start self-balancing block
      block(body, nodeCount) {
        this._blockStarts.push(this._nodes.length);
        if (body)
          this.code(body).endBlock(nodeCount);
        return this;
      }
      // end the current self-balancing block
      endBlock(nodeCount) {
        const len = this._blockStarts.pop();
        if (len === void 0)
          throw new Error("CodeGen: not in self-balancing block");
        const toClose = this._nodes.length - len;
        if (toClose < 0 || nodeCount !== void 0 && toClose !== nodeCount) {
          throw new Error(`CodeGen: wrong number of nodes: ${toClose} vs ${nodeCount} expected`);
        }
        this._nodes.length = len;
        return this;
      }
      // `function` heading (or definition if funcBody is passed)
      func(name, args = code_1.nil, async, funcBody) {
        this._blockNode(new Func(name, args, async));
        if (funcBody)
          this.code(funcBody).endFunc();
        return this;
      }
      // end function definition
      endFunc() {
        return this._endBlockNode(Func);
      }
      optimize(n = 1) {
        while (n-- > 0) {
          this._root.optimizeNodes();
          this._root.optimizeNames(this._root.names, this._constants);
        }
      }
      _leafNode(node) {
        this._currNode.nodes.push(node);
        return this;
      }
      _blockNode(node) {
        this._currNode.nodes.push(node);
        this._nodes.push(node);
      }
      _endBlockNode(N1, N22) {
        const n = this._currNode;
        if (n instanceof N1 || N22 && n instanceof N22) {
          this._nodes.pop();
          return this;
        }
        throw new Error(`CodeGen: not in block "${N22 ? `${N1.kind}/${N22.kind}` : N1.kind}"`);
      }
      _elseNode(node) {
        const n = this._currNode;
        if (!(n instanceof If)) {
          throw new Error('CodeGen: "else" without "if"');
        }
        this._currNode = n.else = node;
        return this;
      }
      get _root() {
        return this._nodes[0];
      }
      get _currNode() {
        const ns = this._nodes;
        return ns[ns.length - 1];
      }
      set _currNode(node) {
        const ns = this._nodes;
        ns[ns.length - 1] = node;
      }
    };
    exports.CodeGen = CodeGen;
    function addNames(names, from) {
      for (const n in from)
        names[n] = (names[n] || 0) + (from[n] || 0);
      return names;
    }
    function addExprNames(names, from) {
      return from instanceof code_1._CodeOrName ? addNames(names, from.names) : names;
    }
    function optimizeExpr(expr, names, constants3) {
      if (expr instanceof code_1.Name)
        return replaceName(expr);
      if (!canOptimize(expr))
        return expr;
      return new code_1._Code(expr._items.reduce((items, c) => {
        if (c instanceof code_1.Name)
          c = replaceName(c);
        if (c instanceof code_1._Code)
          items.push(...c._items);
        else
          items.push(c);
        return items;
      }, []));
      function replaceName(n) {
        const c = constants3[n.str];
        if (c === void 0 || names[n.str] !== 1)
          return n;
        delete names[n.str];
        return c;
      }
      function canOptimize(e) {
        return e instanceof code_1._Code && e._items.some((c) => c instanceof code_1.Name && names[c.str] === 1 && constants3[c.str] !== void 0);
      }
    }
    function subtractNames(names, from) {
      for (const n in from)
        names[n] = (names[n] || 0) - (from[n] || 0);
    }
    function not(x3) {
      return typeof x3 == "boolean" || typeof x3 == "number" || x3 === null ? !x3 : (0, code_1._)`!${par(x3)}`;
    }
    exports.not = not;
    var andCode = mappend(exports.operators.AND);
    function and(...args) {
      return args.reduce(andCode);
    }
    exports.and = and;
    var orCode = mappend(exports.operators.OR);
    function or(...args) {
      return args.reduce(orCode);
    }
    exports.or = or;
    function mappend(op) {
      return (x3, y2) => x3 === code_1.nil ? y2 : y2 === code_1.nil ? x3 : (0, code_1._)`${par(x3)} ${op} ${par(y2)}`;
    }
    function par(x3) {
      return x3 instanceof code_1.Name ? x3 : (0, code_1._)`(${x3})`;
    }
  }
});

// node_modules/ajv/dist/compile/util.js
var require_util = __commonJS({
  "node_modules/ajv/dist/compile/util.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.checkStrictMode = exports.getErrorPath = exports.Type = exports.useFunc = exports.setEvaluated = exports.evaluatedPropsToName = exports.mergeEvaluated = exports.eachItem = exports.unescapeJsonPointer = exports.escapeJsonPointer = exports.escapeFragment = exports.unescapeFragment = exports.schemaRefOrVal = exports.schemaHasRulesButRef = exports.schemaHasRules = exports.checkUnknownRules = exports.alwaysValidSchema = exports.toHash = void 0;
    var codegen_1 = require_codegen();
    var code_1 = require_code();
    function toHash(arr) {
      const hash = {};
      for (const item of arr)
        hash[item] = true;
      return hash;
    }
    exports.toHash = toHash;
    function alwaysValidSchema(it2, schema) {
      if (typeof schema == "boolean")
        return schema;
      if (Object.keys(schema).length === 0)
        return true;
      checkUnknownRules(it2, schema);
      return !schemaHasRules(schema, it2.self.RULES.all);
    }
    exports.alwaysValidSchema = alwaysValidSchema;
    function checkUnknownRules(it2, schema = it2.schema) {
      const { opts, self } = it2;
      if (!opts.strictSchema)
        return;
      if (typeof schema === "boolean")
        return;
      const rules = self.RULES.keywords;
      for (const key in schema) {
        if (!rules[key])
          checkStrictMode(it2, `unknown keyword: "${key}"`);
      }
    }
    exports.checkUnknownRules = checkUnknownRules;
    function schemaHasRules(schema, rules) {
      if (typeof schema == "boolean")
        return !schema;
      for (const key in schema)
        if (rules[key])
          return true;
      return false;
    }
    exports.schemaHasRules = schemaHasRules;
    function schemaHasRulesButRef(schema, RULES) {
      if (typeof schema == "boolean")
        return !schema;
      for (const key in schema)
        if (key !== "$ref" && RULES.all[key])
          return true;
      return false;
    }
    exports.schemaHasRulesButRef = schemaHasRulesButRef;
    function schemaRefOrVal({ topSchemaRef, schemaPath }, schema, keyword, $data) {
      if (!$data) {
        if (typeof schema == "number" || typeof schema == "boolean")
          return schema;
        if (typeof schema == "string")
          return (0, codegen_1._)`${schema}`;
      }
      return (0, codegen_1._)`${topSchemaRef}${schemaPath}${(0, codegen_1.getProperty)(keyword)}`;
    }
    exports.schemaRefOrVal = schemaRefOrVal;
    function unescapeFragment(str) {
      return unescapeJsonPointer(decodeURIComponent(str));
    }
    exports.unescapeFragment = unescapeFragment;
    function escapeFragment(str) {
      return encodeURIComponent(escapeJsonPointer(str));
    }
    exports.escapeFragment = escapeFragment;
    function escapeJsonPointer(str) {
      if (typeof str == "number")
        return `${str}`;
      return str.replace(/~/g, "~0").replace(/\//g, "~1");
    }
    exports.escapeJsonPointer = escapeJsonPointer;
    function unescapeJsonPointer(str) {
      return str.replace(/~1/g, "/").replace(/~0/g, "~");
    }
    exports.unescapeJsonPointer = unescapeJsonPointer;
    function eachItem(xs, f) {
      if (Array.isArray(xs)) {
        for (const x3 of xs)
          f(x3);
      } else {
        f(xs);
      }
    }
    exports.eachItem = eachItem;
    function makeMergeEvaluated({ mergeNames, mergeToName, mergeValues, resultToName }) {
      return (gen, from, to, toName) => {
        const res = to === void 0 ? from : to instanceof codegen_1.Name ? (from instanceof codegen_1.Name ? mergeNames(gen, from, to) : mergeToName(gen, from, to), to) : from instanceof codegen_1.Name ? (mergeToName(gen, to, from), from) : mergeValues(from, to);
        return toName === codegen_1.Name && !(res instanceof codegen_1.Name) ? resultToName(gen, res) : res;
      };
    }
    exports.mergeEvaluated = {
      props: makeMergeEvaluated({
        mergeNames: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true && ${from} !== undefined`, () => {
          gen.if((0, codegen_1._)`${from} === true`, () => gen.assign(to, true), () => gen.assign(to, (0, codegen_1._)`${to} || {}`).code((0, codegen_1._)`Object.assign(${to}, ${from})`));
        }),
        mergeToName: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true`, () => {
          if (from === true) {
            gen.assign(to, true);
          } else {
            gen.assign(to, (0, codegen_1._)`${to} || {}`);
            setEvaluated(gen, to, from);
          }
        }),
        mergeValues: (from, to) => from === true ? true : { ...from, ...to },
        resultToName: evaluatedPropsToName
      }),
      items: makeMergeEvaluated({
        mergeNames: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true && ${from} !== undefined`, () => gen.assign(to, (0, codegen_1._)`${from} === true ? true : ${to} > ${from} ? ${to} : ${from}`)),
        mergeToName: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true`, () => gen.assign(to, from === true ? true : (0, codegen_1._)`${to} > ${from} ? ${to} : ${from}`)),
        mergeValues: (from, to) => from === true ? true : Math.max(from, to),
        resultToName: (gen, items) => gen.var("items", items)
      })
    };
    function evaluatedPropsToName(gen, ps) {
      if (ps === true)
        return gen.var("props", true);
      const props = gen.var("props", (0, codegen_1._)`{}`);
      if (ps !== void 0)
        setEvaluated(gen, props, ps);
      return props;
    }
    exports.evaluatedPropsToName = evaluatedPropsToName;
    function setEvaluated(gen, props, ps) {
      Object.keys(ps).forEach((p) => gen.assign((0, codegen_1._)`${props}${(0, codegen_1.getProperty)(p)}`, true));
    }
    exports.setEvaluated = setEvaluated;
    var snippets = {};
    function useFunc(gen, f) {
      return gen.scopeValue("func", {
        ref: f,
        code: snippets[f.code] || (snippets[f.code] = new code_1._Code(f.code))
      });
    }
    exports.useFunc = useFunc;
    var Type;
    (function(Type2) {
      Type2[Type2["Num"] = 0] = "Num";
      Type2[Type2["Str"] = 1] = "Str";
    })(Type || (exports.Type = Type = {}));
    function getErrorPath(dataProp, dataPropType, jsPropertySyntax) {
      if (dataProp instanceof codegen_1.Name) {
        const isNumber = dataPropType === Type.Num;
        return jsPropertySyntax ? isNumber ? (0, codegen_1._)`"[" + ${dataProp} + "]"` : (0, codegen_1._)`"['" + ${dataProp} + "']"` : isNumber ? (0, codegen_1._)`"/" + ${dataProp}` : (0, codegen_1._)`"/" + ${dataProp}.replace(/~/g, "~0").replace(/\\//g, "~1")`;
      }
      return jsPropertySyntax ? (0, codegen_1.getProperty)(dataProp).toString() : "/" + escapeJsonPointer(dataProp);
    }
    exports.getErrorPath = getErrorPath;
    function checkStrictMode(it2, msg, mode = it2.opts.strictSchema) {
      if (!mode)
        return;
      msg = `strict mode: ${msg}`;
      if (mode === true)
        throw new Error(msg);
      it2.self.logger.warn(msg);
    }
    exports.checkStrictMode = checkStrictMode;
  }
});

// node_modules/ajv/dist/compile/names.js
var require_names = __commonJS({
  "node_modules/ajv/dist/compile/names.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var names = {
      // validation function arguments
      data: new codegen_1.Name("data"),
      // data passed to validation function
      // args passed from referencing schema
      valCxt: new codegen_1.Name("valCxt"),
      // validation/data context - should not be used directly, it is destructured to the names below
      instancePath: new codegen_1.Name("instancePath"),
      parentData: new codegen_1.Name("parentData"),
      parentDataProperty: new codegen_1.Name("parentDataProperty"),
      rootData: new codegen_1.Name("rootData"),
      // root data - same as the data passed to the first/top validation function
      dynamicAnchors: new codegen_1.Name("dynamicAnchors"),
      // used to support recursiveRef and dynamicRef
      // function scoped variables
      vErrors: new codegen_1.Name("vErrors"),
      // null or array of validation errors
      errors: new codegen_1.Name("errors"),
      // counter of validation errors
      this: new codegen_1.Name("this"),
      // "globals"
      self: new codegen_1.Name("self"),
      scope: new codegen_1.Name("scope"),
      // JTD serialize/parse name for JSON string and position
      json: new codegen_1.Name("json"),
      jsonPos: new codegen_1.Name("jsonPos"),
      jsonLen: new codegen_1.Name("jsonLen"),
      jsonPart: new codegen_1.Name("jsonPart")
    };
    exports.default = names;
  }
});

// node_modules/ajv/dist/compile/errors.js
var require_errors = __commonJS({
  "node_modules/ajv/dist/compile/errors.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.extendErrors = exports.resetErrorsCount = exports.reportExtraError = exports.reportError = exports.keyword$DataError = exports.keywordError = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var names_1 = require_names();
    exports.keywordError = {
      message: ({ keyword }) => (0, codegen_1.str)`must pass "${keyword}" keyword validation`
    };
    exports.keyword$DataError = {
      message: ({ keyword, schemaType }) => schemaType ? (0, codegen_1.str)`"${keyword}" keyword must be ${schemaType} ($data)` : (0, codegen_1.str)`"${keyword}" keyword is invalid ($data)`
    };
    function reportError(cxt, error = exports.keywordError, errorPaths, overrideAllErrors) {
      const { it: it2 } = cxt;
      const { gen, compositeRule, allErrors } = it2;
      const errObj = errorObjectCode(cxt, error, errorPaths);
      if (overrideAllErrors !== null && overrideAllErrors !== void 0 ? overrideAllErrors : compositeRule || allErrors) {
        addError(gen, errObj);
      } else {
        returnErrors(it2, (0, codegen_1._)`[${errObj}]`);
      }
    }
    exports.reportError = reportError;
    function reportExtraError(cxt, error = exports.keywordError, errorPaths) {
      const { it: it2 } = cxt;
      const { gen, compositeRule, allErrors } = it2;
      const errObj = errorObjectCode(cxt, error, errorPaths);
      addError(gen, errObj);
      if (!(compositeRule || allErrors)) {
        returnErrors(it2, names_1.default.vErrors);
      }
    }
    exports.reportExtraError = reportExtraError;
    function resetErrorsCount(gen, errsCount) {
      gen.assign(names_1.default.errors, errsCount);
      gen.if((0, codegen_1._)`${names_1.default.vErrors} !== null`, () => gen.if(errsCount, () => gen.assign((0, codegen_1._)`${names_1.default.vErrors}.length`, errsCount), () => gen.assign(names_1.default.vErrors, null)));
    }
    exports.resetErrorsCount = resetErrorsCount;
    function extendErrors({ gen, keyword, schemaValue, data, errsCount, it: it2 }) {
      if (errsCount === void 0)
        throw new Error("ajv implementation error");
      const err = gen.name("err");
      gen.forRange("i", errsCount, names_1.default.errors, (i) => {
        gen.const(err, (0, codegen_1._)`${names_1.default.vErrors}[${i}]`);
        gen.if((0, codegen_1._)`${err}.instancePath === undefined`, () => gen.assign((0, codegen_1._)`${err}.instancePath`, (0, codegen_1.strConcat)(names_1.default.instancePath, it2.errorPath)));
        gen.assign((0, codegen_1._)`${err}.schemaPath`, (0, codegen_1.str)`${it2.errSchemaPath}/${keyword}`);
        if (it2.opts.verbose) {
          gen.assign((0, codegen_1._)`${err}.schema`, schemaValue);
          gen.assign((0, codegen_1._)`${err}.data`, data);
        }
      });
    }
    exports.extendErrors = extendErrors;
    function addError(gen, errObj) {
      const err = gen.const("err", errObj);
      gen.if((0, codegen_1._)`${names_1.default.vErrors} === null`, () => gen.assign(names_1.default.vErrors, (0, codegen_1._)`[${err}]`), (0, codegen_1._)`${names_1.default.vErrors}.push(${err})`);
      gen.code((0, codegen_1._)`${names_1.default.errors}++`);
    }
    function returnErrors(it2, errs) {
      const { gen, validateName, schemaEnv } = it2;
      if (schemaEnv.$async) {
        gen.throw((0, codegen_1._)`new ${it2.ValidationError}(${errs})`);
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, errs);
        gen.return(false);
      }
    }
    var E = {
      keyword: new codegen_1.Name("keyword"),
      schemaPath: new codegen_1.Name("schemaPath"),
      // also used in JTD errors
      params: new codegen_1.Name("params"),
      propertyName: new codegen_1.Name("propertyName"),
      message: new codegen_1.Name("message"),
      schema: new codegen_1.Name("schema"),
      parentSchema: new codegen_1.Name("parentSchema")
    };
    function errorObjectCode(cxt, error, errorPaths) {
      const { createErrors } = cxt.it;
      if (createErrors === false)
        return (0, codegen_1._)`{}`;
      return errorObject(cxt, error, errorPaths);
    }
    function errorObject(cxt, error, errorPaths = {}) {
      const { gen, it: it2 } = cxt;
      const keyValues = [
        errorInstancePath(it2, errorPaths),
        errorSchemaPath(cxt, errorPaths)
      ];
      extraErrorProps(cxt, error, keyValues);
      return gen.object(...keyValues);
    }
    function errorInstancePath({ errorPath }, { instancePath }) {
      const instPath = instancePath ? (0, codegen_1.str)`${errorPath}${(0, util_1.getErrorPath)(instancePath, util_1.Type.Str)}` : errorPath;
      return [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, instPath)];
    }
    function errorSchemaPath({ keyword, it: { errSchemaPath } }, { schemaPath, parentSchema }) {
      let schPath = parentSchema ? errSchemaPath : (0, codegen_1.str)`${errSchemaPath}/${keyword}`;
      if (schemaPath) {
        schPath = (0, codegen_1.str)`${schPath}${(0, util_1.getErrorPath)(schemaPath, util_1.Type.Str)}`;
      }
      return [E.schemaPath, schPath];
    }
    function extraErrorProps(cxt, { params, message }, keyValues) {
      const { keyword, data, schemaValue, it: it2 } = cxt;
      const { opts, propertyName, topSchemaRef, schemaPath } = it2;
      keyValues.push([E.keyword, keyword], [E.params, typeof params == "function" ? params(cxt) : params || (0, codegen_1._)`{}`]);
      if (opts.messages) {
        keyValues.push([E.message, typeof message == "function" ? message(cxt) : message]);
      }
      if (opts.verbose) {
        keyValues.push([E.schema, schemaValue], [E.parentSchema, (0, codegen_1._)`${topSchemaRef}${schemaPath}`], [names_1.default.data, data]);
      }
      if (propertyName)
        keyValues.push([E.propertyName, propertyName]);
    }
  }
});

// node_modules/ajv/dist/compile/validate/boolSchema.js
var require_boolSchema = __commonJS({
  "node_modules/ajv/dist/compile/validate/boolSchema.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.boolOrEmptySchema = exports.topBoolOrEmptySchema = void 0;
    var errors_1 = require_errors();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var boolError = {
      message: "boolean schema is false"
    };
    function topBoolOrEmptySchema(it2) {
      const { gen, schema, validateName } = it2;
      if (schema === false) {
        falseSchemaError(it2, false);
      } else if (typeof schema == "object" && schema.$async === true) {
        gen.return(names_1.default.data);
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, null);
        gen.return(true);
      }
    }
    exports.topBoolOrEmptySchema = topBoolOrEmptySchema;
    function boolOrEmptySchema(it2, valid) {
      const { gen, schema } = it2;
      if (schema === false) {
        gen.var(valid, false);
        falseSchemaError(it2);
      } else {
        gen.var(valid, true);
      }
    }
    exports.boolOrEmptySchema = boolOrEmptySchema;
    function falseSchemaError(it2, overrideAllErrors) {
      const { gen, data } = it2;
      const cxt = {
        gen,
        keyword: "false schema",
        data,
        schema: false,
        schemaCode: false,
        schemaValue: false,
        params: {},
        it: it2
      };
      (0, errors_1.reportError)(cxt, boolError, void 0, overrideAllErrors);
    }
  }
});

// node_modules/ajv/dist/compile/rules.js
var require_rules = __commonJS({
  "node_modules/ajv/dist/compile/rules.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getRules = exports.isJSONType = void 0;
    var _jsonTypes = ["string", "number", "integer", "boolean", "null", "object", "array"];
    var jsonTypes = new Set(_jsonTypes);
    function isJSONType(x3) {
      return typeof x3 == "string" && jsonTypes.has(x3);
    }
    exports.isJSONType = isJSONType;
    function getRules() {
      const groups = {
        number: { type: "number", rules: [] },
        string: { type: "string", rules: [] },
        array: { type: "array", rules: [] },
        object: { type: "object", rules: [] }
      };
      return {
        types: { ...groups, integer: true, boolean: true, null: true },
        rules: [{ rules: [] }, groups.number, groups.string, groups.array, groups.object],
        post: { rules: [] },
        all: {},
        keywords: {}
      };
    }
    exports.getRules = getRules;
  }
});

// node_modules/ajv/dist/compile/validate/applicability.js
var require_applicability = __commonJS({
  "node_modules/ajv/dist/compile/validate/applicability.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.shouldUseRule = exports.shouldUseGroup = exports.schemaHasRulesForType = void 0;
    function schemaHasRulesForType({ schema, self }, type) {
      const group = self.RULES.types[type];
      return group && group !== true && shouldUseGroup(schema, group);
    }
    exports.schemaHasRulesForType = schemaHasRulesForType;
    function shouldUseGroup(schema, group) {
      return group.rules.some((rule) => shouldUseRule(schema, rule));
    }
    exports.shouldUseGroup = shouldUseGroup;
    function shouldUseRule(schema, rule) {
      var _a;
      return schema[rule.keyword] !== void 0 || ((_a = rule.definition.implements) === null || _a === void 0 ? void 0 : _a.some((kwd) => schema[kwd] !== void 0));
    }
    exports.shouldUseRule = shouldUseRule;
  }
});

// node_modules/ajv/dist/compile/validate/dataType.js
var require_dataType = __commonJS({
  "node_modules/ajv/dist/compile/validate/dataType.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.reportTypeError = exports.checkDataTypes = exports.checkDataType = exports.coerceAndCheckDataType = exports.getJSONTypes = exports.getSchemaTypes = exports.DataType = void 0;
    var rules_1 = require_rules();
    var applicability_1 = require_applicability();
    var errors_1 = require_errors();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var DataType;
    (function(DataType2) {
      DataType2[DataType2["Correct"] = 0] = "Correct";
      DataType2[DataType2["Wrong"] = 1] = "Wrong";
    })(DataType || (exports.DataType = DataType = {}));
    function getSchemaTypes(schema) {
      const types = getJSONTypes(schema.type);
      const hasNull = types.includes("null");
      if (hasNull) {
        if (schema.nullable === false)
          throw new Error("type: null contradicts nullable: false");
      } else {
        if (!types.length && schema.nullable !== void 0) {
          throw new Error('"nullable" cannot be used without "type"');
        }
        if (schema.nullable === true)
          types.push("null");
      }
      return types;
    }
    exports.getSchemaTypes = getSchemaTypes;
    function getJSONTypes(ts) {
      const types = Array.isArray(ts) ? ts : ts ? [ts] : [];
      if (types.every(rules_1.isJSONType))
        return types;
      throw new Error("type must be JSONType or JSONType[]: " + types.join(","));
    }
    exports.getJSONTypes = getJSONTypes;
    function coerceAndCheckDataType(it2, types) {
      const { gen, data, opts } = it2;
      const coerceTo = coerceToTypes(types, opts.coerceTypes);
      const checkTypes = types.length > 0 && !(coerceTo.length === 0 && types.length === 1 && (0, applicability_1.schemaHasRulesForType)(it2, types[0]));
      if (checkTypes) {
        const wrongType = checkDataTypes(types, data, opts.strictNumbers, DataType.Wrong);
        gen.if(wrongType, () => {
          if (coerceTo.length)
            coerceData(it2, types, coerceTo);
          else
            reportTypeError(it2);
        });
      }
      return checkTypes;
    }
    exports.coerceAndCheckDataType = coerceAndCheckDataType;
    var COERCIBLE = /* @__PURE__ */ new Set(["string", "number", "integer", "boolean", "null"]);
    function coerceToTypes(types, coerceTypes) {
      return coerceTypes ? types.filter((t2) => COERCIBLE.has(t2) || coerceTypes === "array" && t2 === "array") : [];
    }
    function coerceData(it2, types, coerceTo) {
      const { gen, data, opts } = it2;
      const dataType = gen.let("dataType", (0, codegen_1._)`typeof ${data}`);
      const coerced = gen.let("coerced", (0, codegen_1._)`undefined`);
      if (opts.coerceTypes === "array") {
        gen.if((0, codegen_1._)`${dataType} == 'object' && Array.isArray(${data}) && ${data}.length == 1`, () => gen.assign(data, (0, codegen_1._)`${data}[0]`).assign(dataType, (0, codegen_1._)`typeof ${data}`).if(checkDataTypes(types, data, opts.strictNumbers), () => gen.assign(coerced, data)));
      }
      gen.if((0, codegen_1._)`${coerced} !== undefined`);
      for (const t2 of coerceTo) {
        if (COERCIBLE.has(t2) || t2 === "array" && opts.coerceTypes === "array") {
          coerceSpecificType(t2);
        }
      }
      gen.else();
      reportTypeError(it2);
      gen.endIf();
      gen.if((0, codegen_1._)`${coerced} !== undefined`, () => {
        gen.assign(data, coerced);
        assignParentData(it2, coerced);
      });
      function coerceSpecificType(t2) {
        switch (t2) {
          case "string":
            gen.elseIf((0, codegen_1._)`${dataType} == "number" || ${dataType} == "boolean"`).assign(coerced, (0, codegen_1._)`"" + ${data}`).elseIf((0, codegen_1._)`${data} === null`).assign(coerced, (0, codegen_1._)`""`);
            return;
          case "number":
            gen.elseIf((0, codegen_1._)`${dataType} == "boolean" || ${data} === null
              || (${dataType} == "string" && ${data} && ${data} == +${data})`).assign(coerced, (0, codegen_1._)`+${data}`);
            return;
          case "integer":
            gen.elseIf((0, codegen_1._)`${dataType} === "boolean" || ${data} === null
              || (${dataType} === "string" && ${data} && ${data} == +${data} && !(${data} % 1))`).assign(coerced, (0, codegen_1._)`+${data}`);
            return;
          case "boolean":
            gen.elseIf((0, codegen_1._)`${data} === "false" || ${data} === 0 || ${data} === null`).assign(coerced, false).elseIf((0, codegen_1._)`${data} === "true" || ${data} === 1`).assign(coerced, true);
            return;
          case "null":
            gen.elseIf((0, codegen_1._)`${data} === "" || ${data} === 0 || ${data} === false`);
            gen.assign(coerced, null);
            return;
          case "array":
            gen.elseIf((0, codegen_1._)`${dataType} === "string" || ${dataType} === "number"
              || ${dataType} === "boolean" || ${data} === null`).assign(coerced, (0, codegen_1._)`[${data}]`);
        }
      }
    }
    function assignParentData({ gen, parentData, parentDataProperty }, expr) {
      gen.if((0, codegen_1._)`${parentData} !== undefined`, () => gen.assign((0, codegen_1._)`${parentData}[${parentDataProperty}]`, expr));
    }
    function checkDataType(dataType, data, strictNums, correct = DataType.Correct) {
      const EQ = correct === DataType.Correct ? codegen_1.operators.EQ : codegen_1.operators.NEQ;
      let cond;
      switch (dataType) {
        case "null":
          return (0, codegen_1._)`${data} ${EQ} null`;
        case "array":
          cond = (0, codegen_1._)`Array.isArray(${data})`;
          break;
        case "object":
          cond = (0, codegen_1._)`${data} && typeof ${data} == "object" && !Array.isArray(${data})`;
          break;
        case "integer":
          cond = numCond((0, codegen_1._)`!(${data} % 1) && !isNaN(${data})`);
          break;
        case "number":
          cond = numCond();
          break;
        default:
          return (0, codegen_1._)`typeof ${data} ${EQ} ${dataType}`;
      }
      return correct === DataType.Correct ? cond : (0, codegen_1.not)(cond);
      function numCond(_cond = codegen_1.nil) {
        return (0, codegen_1.and)((0, codegen_1._)`typeof ${data} == "number"`, _cond, strictNums ? (0, codegen_1._)`isFinite(${data})` : codegen_1.nil);
      }
    }
    exports.checkDataType = checkDataType;
    function checkDataTypes(dataTypes, data, strictNums, correct) {
      if (dataTypes.length === 1) {
        return checkDataType(dataTypes[0], data, strictNums, correct);
      }
      let cond;
      const types = (0, util_1.toHash)(dataTypes);
      if (types.array && types.object) {
        const notObj = (0, codegen_1._)`typeof ${data} != "object"`;
        cond = types.null ? notObj : (0, codegen_1._)`!${data} || ${notObj}`;
        delete types.null;
        delete types.array;
        delete types.object;
      } else {
        cond = codegen_1.nil;
      }
      if (types.number)
        delete types.integer;
      for (const t2 in types)
        cond = (0, codegen_1.and)(cond, checkDataType(t2, data, strictNums, correct));
      return cond;
    }
    exports.checkDataTypes = checkDataTypes;
    var typeError = {
      message: ({ schema }) => `must be ${schema}`,
      params: ({ schema, schemaValue }) => typeof schema == "string" ? (0, codegen_1._)`{type: ${schema}}` : (0, codegen_1._)`{type: ${schemaValue}}`
    };
    function reportTypeError(it2) {
      const cxt = getTypeErrorContext(it2);
      (0, errors_1.reportError)(cxt, typeError);
    }
    exports.reportTypeError = reportTypeError;
    function getTypeErrorContext(it2) {
      const { gen, data, schema } = it2;
      const schemaCode = (0, util_1.schemaRefOrVal)(it2, schema, "type");
      return {
        gen,
        keyword: "type",
        data,
        schema: schema.type,
        schemaCode,
        schemaValue: schemaCode,
        parentSchema: schema,
        params: {},
        it: it2
      };
    }
  }
});

// node_modules/ajv/dist/compile/validate/defaults.js
var require_defaults = __commonJS({
  "node_modules/ajv/dist/compile/validate/defaults.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.assignDefaults = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    function assignDefaults(it2, ty) {
      const { properties, items } = it2.schema;
      if (ty === "object" && properties) {
        for (const key in properties) {
          assignDefault(it2, key, properties[key].default);
        }
      } else if (ty === "array" && Array.isArray(items)) {
        items.forEach((sch, i) => assignDefault(it2, i, sch.default));
      }
    }
    exports.assignDefaults = assignDefaults;
    function assignDefault(it2, prop, defaultValue) {
      const { gen, compositeRule, data, opts } = it2;
      if (defaultValue === void 0)
        return;
      const childData = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(prop)}`;
      if (compositeRule) {
        (0, util_1.checkStrictMode)(it2, `default is ignored for: ${childData}`);
        return;
      }
      let condition = (0, codegen_1._)`${childData} === undefined`;
      if (opts.useDefaults === "empty") {
        condition = (0, codegen_1._)`${condition} || ${childData} === null || ${childData} === ""`;
      }
      gen.if(condition, (0, codegen_1._)`${childData} = ${(0, codegen_1.stringify)(defaultValue)}`);
    }
  }
});

// node_modules/ajv/dist/vocabularies/code.js
var require_code2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/code.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateUnion = exports.validateArray = exports.usePattern = exports.callValidateCode = exports.schemaProperties = exports.allSchemaProperties = exports.noPropertyInData = exports.propertyInData = exports.isOwnProperty = exports.hasPropFunc = exports.reportMissingProp = exports.checkMissingProp = exports.checkReportMissingProp = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var names_1 = require_names();
    var util_2 = require_util();
    function checkReportMissingProp(cxt, prop) {
      const { gen, data, it: it2 } = cxt;
      gen.if(noPropertyInData(gen, data, prop, it2.opts.ownProperties), () => {
        cxt.setParams({ missingProperty: (0, codegen_1._)`${prop}` }, true);
        cxt.error();
      });
    }
    exports.checkReportMissingProp = checkReportMissingProp;
    function checkMissingProp({ gen, data, it: { opts } }, properties, missing) {
      return (0, codegen_1.or)(...properties.map((prop) => (0, codegen_1.and)(noPropertyInData(gen, data, prop, opts.ownProperties), (0, codegen_1._)`${missing} = ${prop}`)));
    }
    exports.checkMissingProp = checkMissingProp;
    function reportMissingProp(cxt, missing) {
      cxt.setParams({ missingProperty: missing }, true);
      cxt.error();
    }
    exports.reportMissingProp = reportMissingProp;
    function hasPropFunc(gen) {
      return gen.scopeValue("func", {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        ref: Object.prototype.hasOwnProperty,
        code: (0, codegen_1._)`Object.prototype.hasOwnProperty`
      });
    }
    exports.hasPropFunc = hasPropFunc;
    function isOwnProperty(gen, data, property) {
      return (0, codegen_1._)`${hasPropFunc(gen)}.call(${data}, ${property})`;
    }
    exports.isOwnProperty = isOwnProperty;
    function propertyInData(gen, data, property, ownProperties) {
      const cond = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(property)} !== undefined`;
      return ownProperties ? (0, codegen_1._)`${cond} && ${isOwnProperty(gen, data, property)}` : cond;
    }
    exports.propertyInData = propertyInData;
    function noPropertyInData(gen, data, property, ownProperties) {
      const cond = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(property)} === undefined`;
      return ownProperties ? (0, codegen_1.or)(cond, (0, codegen_1.not)(isOwnProperty(gen, data, property))) : cond;
    }
    exports.noPropertyInData = noPropertyInData;
    function allSchemaProperties(schemaMap) {
      return schemaMap ? Object.keys(schemaMap).filter((p) => p !== "__proto__") : [];
    }
    exports.allSchemaProperties = allSchemaProperties;
    function schemaProperties(it2, schemaMap) {
      return allSchemaProperties(schemaMap).filter((p) => !(0, util_1.alwaysValidSchema)(it2, schemaMap[p]));
    }
    exports.schemaProperties = schemaProperties;
    function callValidateCode({ schemaCode, data, it: { gen, topSchemaRef, schemaPath, errorPath }, it: it2 }, func, context, passSchema) {
      const dataAndSchema = passSchema ? (0, codegen_1._)`${schemaCode}, ${data}, ${topSchemaRef}${schemaPath}` : data;
      const valCxt = [
        [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, errorPath)],
        [names_1.default.parentData, it2.parentData],
        [names_1.default.parentDataProperty, it2.parentDataProperty],
        [names_1.default.rootData, names_1.default.rootData]
      ];
      if (it2.opts.dynamicRef)
        valCxt.push([names_1.default.dynamicAnchors, names_1.default.dynamicAnchors]);
      const args = (0, codegen_1._)`${dataAndSchema}, ${gen.object(...valCxt)}`;
      return context !== codegen_1.nil ? (0, codegen_1._)`${func}.call(${context}, ${args})` : (0, codegen_1._)`${func}(${args})`;
    }
    exports.callValidateCode = callValidateCode;
    var newRegExp = (0, codegen_1._)`new RegExp`;
    function usePattern({ gen, it: { opts } }, pattern) {
      const u = opts.unicodeRegExp ? "u" : "";
      const { regExp } = opts.code;
      const rx = regExp(pattern, u);
      return gen.scopeValue("pattern", {
        key: rx.toString(),
        ref: rx,
        code: (0, codegen_1._)`${regExp.code === "new RegExp" ? newRegExp : (0, util_2.useFunc)(gen, regExp)}(${pattern}, ${u})`
      });
    }
    exports.usePattern = usePattern;
    function validateArray(cxt) {
      const { gen, data, keyword, it: it2 } = cxt;
      const valid = gen.name("valid");
      if (it2.allErrors) {
        const validArr = gen.let("valid", true);
        validateItems(() => gen.assign(validArr, false));
        return validArr;
      }
      gen.var(valid, true);
      validateItems(() => gen.break());
      return valid;
      function validateItems(notValid) {
        const len = gen.const("len", (0, codegen_1._)`${data}.length`);
        gen.forRange("i", 0, len, (i) => {
          cxt.subschema({
            keyword,
            dataProp: i,
            dataPropType: util_1.Type.Num
          }, valid);
          gen.if((0, codegen_1.not)(valid), notValid);
        });
      }
    }
    exports.validateArray = validateArray;
    function validateUnion(cxt) {
      const { gen, schema, keyword, it: it2 } = cxt;
      if (!Array.isArray(schema))
        throw new Error("ajv implementation error");
      const alwaysValid = schema.some((sch) => (0, util_1.alwaysValidSchema)(it2, sch));
      if (alwaysValid && !it2.opts.unevaluated)
        return;
      const valid = gen.let("valid", false);
      const schValid = gen.name("_valid");
      gen.block(() => schema.forEach((_sch, i) => {
        const schCxt = cxt.subschema({
          keyword,
          schemaProp: i,
          compositeRule: true
        }, schValid);
        gen.assign(valid, (0, codegen_1._)`${valid} || ${schValid}`);
        const merged = cxt.mergeValidEvaluated(schCxt, schValid);
        if (!merged)
          gen.if((0, codegen_1.not)(valid));
      }));
      cxt.result(valid, () => cxt.reset(), () => cxt.error(true));
    }
    exports.validateUnion = validateUnion;
  }
});

// node_modules/ajv/dist/compile/validate/keyword.js
var require_keyword = __commonJS({
  "node_modules/ajv/dist/compile/validate/keyword.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateKeywordUsage = exports.validSchemaType = exports.funcKeywordCode = exports.macroKeywordCode = void 0;
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var code_1 = require_code2();
    var errors_1 = require_errors();
    function macroKeywordCode(cxt, def) {
      const { gen, keyword, schema, parentSchema, it: it2 } = cxt;
      const macroSchema = def.macro.call(it2.self, schema, parentSchema, it2);
      const schemaRef = useKeyword(gen, keyword, macroSchema);
      if (it2.opts.validateSchema !== false)
        it2.self.validateSchema(macroSchema, true);
      const valid = gen.name("valid");
      cxt.subschema({
        schema: macroSchema,
        schemaPath: codegen_1.nil,
        errSchemaPath: `${it2.errSchemaPath}/${keyword}`,
        topSchemaRef: schemaRef,
        compositeRule: true
      }, valid);
      cxt.pass(valid, () => cxt.error(true));
    }
    exports.macroKeywordCode = macroKeywordCode;
    function funcKeywordCode(cxt, def) {
      var _a;
      const { gen, keyword, schema, parentSchema, $data, it: it2 } = cxt;
      checkAsyncKeyword(it2, def);
      const validate2 = !$data && def.compile ? def.compile.call(it2.self, schema, parentSchema, it2) : def.validate;
      const validateRef = useKeyword(gen, keyword, validate2);
      const valid = gen.let("valid");
      cxt.block$data(valid, validateKeyword);
      cxt.ok((_a = def.valid) !== null && _a !== void 0 ? _a : valid);
      function validateKeyword() {
        if (def.errors === false) {
          assignValid();
          if (def.modifying)
            modifyData(cxt);
          reportErrs(() => cxt.error());
        } else {
          const ruleErrs = def.async ? validateAsync() : validateSync();
          if (def.modifying)
            modifyData(cxt);
          reportErrs(() => addErrs(cxt, ruleErrs));
        }
      }
      function validateAsync() {
        const ruleErrs = gen.let("ruleErrs", null);
        gen.try(() => assignValid((0, codegen_1._)`await `), (e) => gen.assign(valid, false).if((0, codegen_1._)`${e} instanceof ${it2.ValidationError}`, () => gen.assign(ruleErrs, (0, codegen_1._)`${e}.errors`), () => gen.throw(e)));
        return ruleErrs;
      }
      function validateSync() {
        const validateErrs = (0, codegen_1._)`${validateRef}.errors`;
        gen.assign(validateErrs, null);
        assignValid(codegen_1.nil);
        return validateErrs;
      }
      function assignValid(_await = def.async ? (0, codegen_1._)`await ` : codegen_1.nil) {
        const passCxt = it2.opts.passContext ? names_1.default.this : names_1.default.self;
        const passSchema = !("compile" in def && !$data || def.schema === false);
        gen.assign(valid, (0, codegen_1._)`${_await}${(0, code_1.callValidateCode)(cxt, validateRef, passCxt, passSchema)}`, def.modifying);
      }
      function reportErrs(errors) {
        var _a2;
        gen.if((0, codegen_1.not)((_a2 = def.valid) !== null && _a2 !== void 0 ? _a2 : valid), errors);
      }
    }
    exports.funcKeywordCode = funcKeywordCode;
    function modifyData(cxt) {
      const { gen, data, it: it2 } = cxt;
      gen.if(it2.parentData, () => gen.assign(data, (0, codegen_1._)`${it2.parentData}[${it2.parentDataProperty}]`));
    }
    function addErrs(cxt, errs) {
      const { gen } = cxt;
      gen.if((0, codegen_1._)`Array.isArray(${errs})`, () => {
        gen.assign(names_1.default.vErrors, (0, codegen_1._)`${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`).assign(names_1.default.errors, (0, codegen_1._)`${names_1.default.vErrors}.length`);
        (0, errors_1.extendErrors)(cxt);
      }, () => cxt.error());
    }
    function checkAsyncKeyword({ schemaEnv }, def) {
      if (def.async && !schemaEnv.$async)
        throw new Error("async keyword in sync schema");
    }
    function useKeyword(gen, keyword, result) {
      if (result === void 0)
        throw new Error(`keyword "${keyword}" failed to compile`);
      return gen.scopeValue("keyword", typeof result == "function" ? { ref: result } : { ref: result, code: (0, codegen_1.stringify)(result) });
    }
    function validSchemaType(schema, schemaType, allowUndefined = false) {
      return !schemaType.length || schemaType.some((st2) => st2 === "array" ? Array.isArray(schema) : st2 === "object" ? schema && typeof schema == "object" && !Array.isArray(schema) : typeof schema == st2 || allowUndefined && typeof schema == "undefined");
    }
    exports.validSchemaType = validSchemaType;
    function validateKeywordUsage({ schema, opts, self, errSchemaPath }, def, keyword) {
      if (Array.isArray(def.keyword) ? !def.keyword.includes(keyword) : def.keyword !== keyword) {
        throw new Error("ajv implementation error");
      }
      const deps = def.dependencies;
      if (deps === null || deps === void 0 ? void 0 : deps.some((kwd) => !Object.prototype.hasOwnProperty.call(schema, kwd))) {
        throw new Error(`parent schema must have dependencies of ${keyword}: ${deps.join(",")}`);
      }
      if (def.validateSchema) {
        const valid = def.validateSchema(schema[keyword]);
        if (!valid) {
          const msg = `keyword "${keyword}" value is invalid at path "${errSchemaPath}": ` + self.errorsText(def.validateSchema.errors);
          if (opts.validateSchema === "log")
            self.logger.error(msg);
          else
            throw new Error(msg);
        }
      }
    }
    exports.validateKeywordUsage = validateKeywordUsage;
  }
});

// node_modules/ajv/dist/compile/validate/subschema.js
var require_subschema = __commonJS({
  "node_modules/ajv/dist/compile/validate/subschema.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.extendSubschemaMode = exports.extendSubschemaData = exports.getSubschema = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    function getSubschema(it2, { keyword, schemaProp, schema, schemaPath, errSchemaPath, topSchemaRef }) {
      if (keyword !== void 0 && schema !== void 0) {
        throw new Error('both "keyword" and "schema" passed, only one allowed');
      }
      if (keyword !== void 0) {
        const sch = it2.schema[keyword];
        return schemaProp === void 0 ? {
          schema: sch,
          schemaPath: (0, codegen_1._)`${it2.schemaPath}${(0, codegen_1.getProperty)(keyword)}`,
          errSchemaPath: `${it2.errSchemaPath}/${keyword}`
        } : {
          schema: sch[schemaProp],
          schemaPath: (0, codegen_1._)`${it2.schemaPath}${(0, codegen_1.getProperty)(keyword)}${(0, codegen_1.getProperty)(schemaProp)}`,
          errSchemaPath: `${it2.errSchemaPath}/${keyword}/${(0, util_1.escapeFragment)(schemaProp)}`
        };
      }
      if (schema !== void 0) {
        if (schemaPath === void 0 || errSchemaPath === void 0 || topSchemaRef === void 0) {
          throw new Error('"schemaPath", "errSchemaPath" and "topSchemaRef" are required with "schema"');
        }
        return {
          schema,
          schemaPath,
          topSchemaRef,
          errSchemaPath
        };
      }
      throw new Error('either "keyword" or "schema" must be passed');
    }
    exports.getSubschema = getSubschema;
    function extendSubschemaData(subschema, it2, { dataProp, dataPropType: dpType, data, dataTypes, propertyName }) {
      if (data !== void 0 && dataProp !== void 0) {
        throw new Error('both "data" and "dataProp" passed, only one allowed');
      }
      const { gen } = it2;
      if (dataProp !== void 0) {
        const { errorPath, dataPathArr, opts } = it2;
        const nextData = gen.let("data", (0, codegen_1._)`${it2.data}${(0, codegen_1.getProperty)(dataProp)}`, true);
        dataContextProps(nextData);
        subschema.errorPath = (0, codegen_1.str)`${errorPath}${(0, util_1.getErrorPath)(dataProp, dpType, opts.jsPropertySyntax)}`;
        subschema.parentDataProperty = (0, codegen_1._)`${dataProp}`;
        subschema.dataPathArr = [...dataPathArr, subschema.parentDataProperty];
      }
      if (data !== void 0) {
        const nextData = data instanceof codegen_1.Name ? data : gen.let("data", data, true);
        dataContextProps(nextData);
        if (propertyName !== void 0)
          subschema.propertyName = propertyName;
      }
      if (dataTypes)
        subschema.dataTypes = dataTypes;
      function dataContextProps(_nextData) {
        subschema.data = _nextData;
        subschema.dataLevel = it2.dataLevel + 1;
        subschema.dataTypes = [];
        it2.definedProperties = /* @__PURE__ */ new Set();
        subschema.parentData = it2.data;
        subschema.dataNames = [...it2.dataNames, _nextData];
      }
    }
    exports.extendSubschemaData = extendSubschemaData;
    function extendSubschemaMode(subschema, { jtdDiscriminator, jtdMetadata, compositeRule, createErrors, allErrors }) {
      if (compositeRule !== void 0)
        subschema.compositeRule = compositeRule;
      if (createErrors !== void 0)
        subschema.createErrors = createErrors;
      if (allErrors !== void 0)
        subschema.allErrors = allErrors;
      subschema.jtdDiscriminator = jtdDiscriminator;
      subschema.jtdMetadata = jtdMetadata;
    }
    exports.extendSubschemaMode = extendSubschemaMode;
  }
});

// node_modules/fast-deep-equal/index.js
var require_fast_deep_equal = __commonJS({
  "node_modules/fast-deep-equal/index.js"(exports, module) {
    "use strict";
    module.exports = function equal(a, b) {
      if (a === b) return true;
      if (a && b && typeof a == "object" && typeof b == "object") {
        if (a.constructor !== b.constructor) return false;
        var length, i, keys;
        if (Array.isArray(a)) {
          length = a.length;
          if (length != b.length) return false;
          for (i = length; i-- !== 0; )
            if (!equal(a[i], b[i])) return false;
          return true;
        }
        if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
        if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
        if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();
        keys = Object.keys(a);
        length = keys.length;
        if (length !== Object.keys(b).length) return false;
        for (i = length; i-- !== 0; )
          if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;
        for (i = length; i-- !== 0; ) {
          var key = keys[i];
          if (!equal(a[key], b[key])) return false;
        }
        return true;
      }
      return a !== a && b !== b;
    };
  }
});

// node_modules/json-schema-traverse/index.js
var require_json_schema_traverse = __commonJS({
  "node_modules/json-schema-traverse/index.js"(exports, module) {
    "use strict";
    var traverse = module.exports = function(schema, opts, cb) {
      if (typeof opts == "function") {
        cb = opts;
        opts = {};
      }
      cb = opts.cb || cb;
      var pre = typeof cb == "function" ? cb : cb.pre || function() {
      };
      var post = cb.post || function() {
      };
      _traverse(opts, pre, post, schema, "", schema);
    };
    traverse.keywords = {
      additionalItems: true,
      items: true,
      contains: true,
      additionalProperties: true,
      propertyNames: true,
      not: true,
      if: true,
      then: true,
      else: true
    };
    traverse.arrayKeywords = {
      items: true,
      allOf: true,
      anyOf: true,
      oneOf: true
    };
    traverse.propsKeywords = {
      $defs: true,
      definitions: true,
      properties: true,
      patternProperties: true,
      dependencies: true
    };
    traverse.skipKeywords = {
      default: true,
      enum: true,
      const: true,
      required: true,
      maximum: true,
      minimum: true,
      exclusiveMaximum: true,
      exclusiveMinimum: true,
      multipleOf: true,
      maxLength: true,
      minLength: true,
      pattern: true,
      format: true,
      maxItems: true,
      minItems: true,
      uniqueItems: true,
      maxProperties: true,
      minProperties: true
    };
    function _traverse(opts, pre, post, schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex) {
      if (schema && typeof schema == "object" && !Array.isArray(schema)) {
        pre(schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
        for (var key in schema) {
          var sch = schema[key];
          if (Array.isArray(sch)) {
            if (key in traverse.arrayKeywords) {
              for (var i = 0; i < sch.length; i++)
                _traverse(opts, pre, post, sch[i], jsonPtr + "/" + key + "/" + i, rootSchema, jsonPtr, key, schema, i);
            }
          } else if (key in traverse.propsKeywords) {
            if (sch && typeof sch == "object") {
              for (var prop in sch)
                _traverse(opts, pre, post, sch[prop], jsonPtr + "/" + key + "/" + escapeJsonPtr(prop), rootSchema, jsonPtr, key, schema, prop);
            }
          } else if (key in traverse.keywords || opts.allKeys && !(key in traverse.skipKeywords)) {
            _traverse(opts, pre, post, sch, jsonPtr + "/" + key, rootSchema, jsonPtr, key, schema);
          }
        }
        post(schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
      }
    }
    function escapeJsonPtr(str) {
      return str.replace(/~/g, "~0").replace(/\//g, "~1");
    }
  }
});

// node_modules/ajv/dist/compile/resolve.js
var require_resolve = __commonJS({
  "node_modules/ajv/dist/compile/resolve.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getSchemaRefs = exports.resolveUrl = exports.normalizeId = exports._getFullPath = exports.getFullPath = exports.inlineRef = void 0;
    var util_1 = require_util();
    var equal = require_fast_deep_equal();
    var traverse = require_json_schema_traverse();
    var SIMPLE_INLINED = /* @__PURE__ */ new Set([
      "type",
      "format",
      "pattern",
      "maxLength",
      "minLength",
      "maxProperties",
      "minProperties",
      "maxItems",
      "minItems",
      "maximum",
      "minimum",
      "uniqueItems",
      "multipleOf",
      "required",
      "enum",
      "const"
    ]);
    function inlineRef(schema, limit = true) {
      if (typeof schema == "boolean")
        return true;
      if (limit === true)
        return !hasRef(schema);
      if (!limit)
        return false;
      return countKeys(schema) <= limit;
    }
    exports.inlineRef = inlineRef;
    var REF_KEYWORDS = /* @__PURE__ */ new Set([
      "$ref",
      "$recursiveRef",
      "$recursiveAnchor",
      "$dynamicRef",
      "$dynamicAnchor"
    ]);
    function hasRef(schema) {
      for (const key in schema) {
        if (REF_KEYWORDS.has(key))
          return true;
        const sch = schema[key];
        if (Array.isArray(sch) && sch.some(hasRef))
          return true;
        if (typeof sch == "object" && hasRef(sch))
          return true;
      }
      return false;
    }
    function countKeys(schema) {
      let count = 0;
      for (const key in schema) {
        if (key === "$ref")
          return Infinity;
        count++;
        if (SIMPLE_INLINED.has(key))
          continue;
        if (typeof schema[key] == "object") {
          (0, util_1.eachItem)(schema[key], (sch) => count += countKeys(sch));
        }
        if (count === Infinity)
          return Infinity;
      }
      return count;
    }
    function getFullPath(resolver, id = "", normalize) {
      if (normalize !== false)
        id = normalizeId(id);
      const p = resolver.parse(id);
      return _getFullPath(resolver, p);
    }
    exports.getFullPath = getFullPath;
    function _getFullPath(resolver, p) {
      const serialized = resolver.serialize(p);
      return serialized.split("#")[0] + "#";
    }
    exports._getFullPath = _getFullPath;
    var TRAILING_SLASH_HASH = /#\/?$/;
    function normalizeId(id) {
      return id ? id.replace(TRAILING_SLASH_HASH, "") : "";
    }
    exports.normalizeId = normalizeId;
    function resolveUrl(resolver, baseId, id) {
      id = normalizeId(id);
      return resolver.resolve(baseId, id);
    }
    exports.resolveUrl = resolveUrl;
    var ANCHOR = /^[a-z_][-a-z0-9._]*$/i;
    function getSchemaRefs(schema, baseId) {
      if (typeof schema == "boolean")
        return {};
      const { schemaId, uriResolver } = this.opts;
      const schId = normalizeId(schema[schemaId] || baseId);
      const baseIds = { "": schId };
      const pathPrefix = getFullPath(uriResolver, schId, false);
      const localRefs = {};
      const schemaRefs = /* @__PURE__ */ new Set();
      traverse(schema, { allKeys: true }, (sch, jsonPtr, _2, parentJsonPtr) => {
        if (parentJsonPtr === void 0)
          return;
        const fullPath = pathPrefix + jsonPtr;
        let innerBaseId = baseIds[parentJsonPtr];
        if (typeof sch[schemaId] == "string")
          innerBaseId = addRef.call(this, sch[schemaId]);
        addAnchor.call(this, sch.$anchor);
        addAnchor.call(this, sch.$dynamicAnchor);
        baseIds[jsonPtr] = innerBaseId;
        function addRef(ref) {
          const _resolve = this.opts.uriResolver.resolve;
          ref = normalizeId(innerBaseId ? _resolve(innerBaseId, ref) : ref);
          if (schemaRefs.has(ref))
            throw ambiguos(ref);
          schemaRefs.add(ref);
          let schOrRef = this.refs[ref];
          if (typeof schOrRef == "string")
            schOrRef = this.refs[schOrRef];
          if (typeof schOrRef == "object") {
            checkAmbiguosRef(sch, schOrRef.schema, ref);
          } else if (ref !== normalizeId(fullPath)) {
            if (ref[0] === "#") {
              checkAmbiguosRef(sch, localRefs[ref], ref);
              localRefs[ref] = sch;
            } else {
              this.refs[ref] = fullPath;
            }
          }
          return ref;
        }
        function addAnchor(anchor) {
          if (typeof anchor == "string") {
            if (!ANCHOR.test(anchor))
              throw new Error(`invalid anchor "${anchor}"`);
            addRef.call(this, `#${anchor}`);
          }
        }
      });
      return localRefs;
      function checkAmbiguosRef(sch1, sch2, ref) {
        if (sch2 !== void 0 && !equal(sch1, sch2))
          throw ambiguos(ref);
      }
      function ambiguos(ref) {
        return new Error(`reference "${ref}" resolves to more than one schema`);
      }
    }
    exports.getSchemaRefs = getSchemaRefs;
  }
});

// node_modules/ajv/dist/compile/validate/index.js
var require_validate = __commonJS({
  "node_modules/ajv/dist/compile/validate/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getData = exports.KeywordCxt = exports.validateFunctionCode = void 0;
    var boolSchema_1 = require_boolSchema();
    var dataType_1 = require_dataType();
    var applicability_1 = require_applicability();
    var dataType_2 = require_dataType();
    var defaults_1 = require_defaults();
    var keyword_1 = require_keyword();
    var subschema_1 = require_subschema();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var resolve_1 = require_resolve();
    var util_1 = require_util();
    var errors_1 = require_errors();
    function validateFunctionCode(it2) {
      if (isSchemaObj(it2)) {
        checkKeywords(it2);
        if (schemaCxtHasRules(it2)) {
          topSchemaObjCode(it2);
          return;
        }
      }
      validateFunction(it2, () => (0, boolSchema_1.topBoolOrEmptySchema)(it2));
    }
    exports.validateFunctionCode = validateFunctionCode;
    function validateFunction({ gen, validateName, schema, schemaEnv, opts }, body) {
      if (opts.code.es5) {
        gen.func(validateName, (0, codegen_1._)`${names_1.default.data}, ${names_1.default.valCxt}`, schemaEnv.$async, () => {
          gen.code((0, codegen_1._)`"use strict"; ${funcSourceUrl(schema, opts)}`);
          destructureValCxtES5(gen, opts);
          gen.code(body);
        });
      } else {
        gen.func(validateName, (0, codegen_1._)`${names_1.default.data}, ${destructureValCxt(opts)}`, schemaEnv.$async, () => gen.code(funcSourceUrl(schema, opts)).code(body));
      }
    }
    function destructureValCxt(opts) {
      return (0, codegen_1._)`{${names_1.default.instancePath}="", ${names_1.default.parentData}, ${names_1.default.parentDataProperty}, ${names_1.default.rootData}=${names_1.default.data}${opts.dynamicRef ? (0, codegen_1._)`, ${names_1.default.dynamicAnchors}={}` : codegen_1.nil}}={}`;
    }
    function destructureValCxtES5(gen, opts) {
      gen.if(names_1.default.valCxt, () => {
        gen.var(names_1.default.instancePath, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.instancePath}`);
        gen.var(names_1.default.parentData, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.parentData}`);
        gen.var(names_1.default.parentDataProperty, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.parentDataProperty}`);
        gen.var(names_1.default.rootData, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.rootData}`);
        if (opts.dynamicRef)
          gen.var(names_1.default.dynamicAnchors, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.dynamicAnchors}`);
      }, () => {
        gen.var(names_1.default.instancePath, (0, codegen_1._)`""`);
        gen.var(names_1.default.parentData, (0, codegen_1._)`undefined`);
        gen.var(names_1.default.parentDataProperty, (0, codegen_1._)`undefined`);
        gen.var(names_1.default.rootData, names_1.default.data);
        if (opts.dynamicRef)
          gen.var(names_1.default.dynamicAnchors, (0, codegen_1._)`{}`);
      });
    }
    function topSchemaObjCode(it2) {
      const { schema, opts, gen } = it2;
      validateFunction(it2, () => {
        if (opts.$comment && schema.$comment)
          commentKeyword(it2);
        checkNoDefault(it2);
        gen.let(names_1.default.vErrors, null);
        gen.let(names_1.default.errors, 0);
        if (opts.unevaluated)
          resetEvaluated(it2);
        typeAndKeywords(it2);
        returnResults(it2);
      });
      return;
    }
    function resetEvaluated(it2) {
      const { gen, validateName } = it2;
      it2.evaluated = gen.const("evaluated", (0, codegen_1._)`${validateName}.evaluated`);
      gen.if((0, codegen_1._)`${it2.evaluated}.dynamicProps`, () => gen.assign((0, codegen_1._)`${it2.evaluated}.props`, (0, codegen_1._)`undefined`));
      gen.if((0, codegen_1._)`${it2.evaluated}.dynamicItems`, () => gen.assign((0, codegen_1._)`${it2.evaluated}.items`, (0, codegen_1._)`undefined`));
    }
    function funcSourceUrl(schema, opts) {
      const schId = typeof schema == "object" && schema[opts.schemaId];
      return schId && (opts.code.source || opts.code.process) ? (0, codegen_1._)`/*# sourceURL=${schId} */` : codegen_1.nil;
    }
    function subschemaCode(it2, valid) {
      if (isSchemaObj(it2)) {
        checkKeywords(it2);
        if (schemaCxtHasRules(it2)) {
          subSchemaObjCode(it2, valid);
          return;
        }
      }
      (0, boolSchema_1.boolOrEmptySchema)(it2, valid);
    }
    function schemaCxtHasRules({ schema, self }) {
      if (typeof schema == "boolean")
        return !schema;
      for (const key in schema)
        if (self.RULES.all[key])
          return true;
      return false;
    }
    function isSchemaObj(it2) {
      return typeof it2.schema != "boolean";
    }
    function subSchemaObjCode(it2, valid) {
      const { schema, gen, opts } = it2;
      if (opts.$comment && schema.$comment)
        commentKeyword(it2);
      updateContext(it2);
      checkAsyncSchema(it2);
      const errsCount = gen.const("_errs", names_1.default.errors);
      typeAndKeywords(it2, errsCount);
      gen.var(valid, (0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
    }
    function checkKeywords(it2) {
      (0, util_1.checkUnknownRules)(it2);
      checkRefsAndKeywords(it2);
    }
    function typeAndKeywords(it2, errsCount) {
      if (it2.opts.jtd)
        return schemaKeywords(it2, [], false, errsCount);
      const types = (0, dataType_1.getSchemaTypes)(it2.schema);
      const checkedTypes = (0, dataType_1.coerceAndCheckDataType)(it2, types);
      schemaKeywords(it2, types, !checkedTypes, errsCount);
    }
    function checkRefsAndKeywords(it2) {
      const { schema, errSchemaPath, opts, self } = it2;
      if (schema.$ref && opts.ignoreKeywordsWithRef && (0, util_1.schemaHasRulesButRef)(schema, self.RULES)) {
        self.logger.warn(`$ref: keywords ignored in schema at path "${errSchemaPath}"`);
      }
    }
    function checkNoDefault(it2) {
      const { schema, opts } = it2;
      if (schema.default !== void 0 && opts.useDefaults && opts.strictSchema) {
        (0, util_1.checkStrictMode)(it2, "default is ignored in the schema root");
      }
    }
    function updateContext(it2) {
      const schId = it2.schema[it2.opts.schemaId];
      if (schId)
        it2.baseId = (0, resolve_1.resolveUrl)(it2.opts.uriResolver, it2.baseId, schId);
    }
    function checkAsyncSchema(it2) {
      if (it2.schema.$async && !it2.schemaEnv.$async)
        throw new Error("async schema in sync schema");
    }
    function commentKeyword({ gen, schemaEnv, schema, errSchemaPath, opts }) {
      const msg = schema.$comment;
      if (opts.$comment === true) {
        gen.code((0, codegen_1._)`${names_1.default.self}.logger.log(${msg})`);
      } else if (typeof opts.$comment == "function") {
        const schemaPath = (0, codegen_1.str)`${errSchemaPath}/$comment`;
        const rootName = gen.scopeValue("root", { ref: schemaEnv.root });
        gen.code((0, codegen_1._)`${names_1.default.self}.opts.$comment(${msg}, ${schemaPath}, ${rootName}.schema)`);
      }
    }
    function returnResults(it2) {
      const { gen, schemaEnv, validateName, ValidationError, opts } = it2;
      if (schemaEnv.$async) {
        gen.if((0, codegen_1._)`${names_1.default.errors} === 0`, () => gen.return(names_1.default.data), () => gen.throw((0, codegen_1._)`new ${ValidationError}(${names_1.default.vErrors})`));
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, names_1.default.vErrors);
        if (opts.unevaluated)
          assignEvaluated(it2);
        gen.return((0, codegen_1._)`${names_1.default.errors} === 0`);
      }
    }
    function assignEvaluated({ gen, evaluated, props, items }) {
      if (props instanceof codegen_1.Name)
        gen.assign((0, codegen_1._)`${evaluated}.props`, props);
      if (items instanceof codegen_1.Name)
        gen.assign((0, codegen_1._)`${evaluated}.items`, items);
    }
    function schemaKeywords(it2, types, typeErrors, errsCount) {
      const { gen, schema, data, allErrors, opts, self } = it2;
      const { RULES } = self;
      if (schema.$ref && (opts.ignoreKeywordsWithRef || !(0, util_1.schemaHasRulesButRef)(schema, RULES))) {
        gen.block(() => keywordCode(it2, "$ref", RULES.all.$ref.definition));
        return;
      }
      if (!opts.jtd)
        checkStrictTypes(it2, types);
      gen.block(() => {
        for (const group of RULES.rules)
          groupKeywords(group);
        groupKeywords(RULES.post);
      });
      function groupKeywords(group) {
        if (!(0, applicability_1.shouldUseGroup)(schema, group))
          return;
        if (group.type) {
          gen.if((0, dataType_2.checkDataType)(group.type, data, opts.strictNumbers));
          iterateKeywords(it2, group);
          if (types.length === 1 && types[0] === group.type && typeErrors) {
            gen.else();
            (0, dataType_2.reportTypeError)(it2);
          }
          gen.endIf();
        } else {
          iterateKeywords(it2, group);
        }
        if (!allErrors)
          gen.if((0, codegen_1._)`${names_1.default.errors} === ${errsCount || 0}`);
      }
    }
    function iterateKeywords(it2, group) {
      const { gen, schema, opts: { useDefaults } } = it2;
      if (useDefaults)
        (0, defaults_1.assignDefaults)(it2, group.type);
      gen.block(() => {
        for (const rule of group.rules) {
          if ((0, applicability_1.shouldUseRule)(schema, rule)) {
            keywordCode(it2, rule.keyword, rule.definition, group.type);
          }
        }
      });
    }
    function checkStrictTypes(it2, types) {
      if (it2.schemaEnv.meta || !it2.opts.strictTypes)
        return;
      checkContextTypes(it2, types);
      if (!it2.opts.allowUnionTypes)
        checkMultipleTypes(it2, types);
      checkKeywordTypes(it2, it2.dataTypes);
    }
    function checkContextTypes(it2, types) {
      if (!types.length)
        return;
      if (!it2.dataTypes.length) {
        it2.dataTypes = types;
        return;
      }
      types.forEach((t2) => {
        if (!includesType(it2.dataTypes, t2)) {
          strictTypesError(it2, `type "${t2}" not allowed by context "${it2.dataTypes.join(",")}"`);
        }
      });
      narrowSchemaTypes(it2, types);
    }
    function checkMultipleTypes(it2, ts) {
      if (ts.length > 1 && !(ts.length === 2 && ts.includes("null"))) {
        strictTypesError(it2, "use allowUnionTypes to allow union type keyword");
      }
    }
    function checkKeywordTypes(it2, ts) {
      const rules = it2.self.RULES.all;
      for (const keyword in rules) {
        const rule = rules[keyword];
        if (typeof rule == "object" && (0, applicability_1.shouldUseRule)(it2.schema, rule)) {
          const { type } = rule.definition;
          if (type.length && !type.some((t2) => hasApplicableType(ts, t2))) {
            strictTypesError(it2, `missing type "${type.join(",")}" for keyword "${keyword}"`);
          }
        }
      }
    }
    function hasApplicableType(schTs, kwdT) {
      return schTs.includes(kwdT) || kwdT === "number" && schTs.includes("integer");
    }
    function includesType(ts, t2) {
      return ts.includes(t2) || t2 === "integer" && ts.includes("number");
    }
    function narrowSchemaTypes(it2, withTypes) {
      const ts = [];
      for (const t2 of it2.dataTypes) {
        if (includesType(withTypes, t2))
          ts.push(t2);
        else if (withTypes.includes("integer") && t2 === "number")
          ts.push("integer");
      }
      it2.dataTypes = ts;
    }
    function strictTypesError(it2, msg) {
      const schemaPath = it2.schemaEnv.baseId + it2.errSchemaPath;
      msg += ` at "${schemaPath}" (strictTypes)`;
      (0, util_1.checkStrictMode)(it2, msg, it2.opts.strictTypes);
    }
    var KeywordCxt = class {
      constructor(it2, def, keyword) {
        (0, keyword_1.validateKeywordUsage)(it2, def, keyword);
        this.gen = it2.gen;
        this.allErrors = it2.allErrors;
        this.keyword = keyword;
        this.data = it2.data;
        this.schema = it2.schema[keyword];
        this.$data = def.$data && it2.opts.$data && this.schema && this.schema.$data;
        this.schemaValue = (0, util_1.schemaRefOrVal)(it2, this.schema, keyword, this.$data);
        this.schemaType = def.schemaType;
        this.parentSchema = it2.schema;
        this.params = {};
        this.it = it2;
        this.def = def;
        if (this.$data) {
          this.schemaCode = it2.gen.const("vSchema", getData(this.$data, it2));
        } else {
          this.schemaCode = this.schemaValue;
          if (!(0, keyword_1.validSchemaType)(this.schema, def.schemaType, def.allowUndefined)) {
            throw new Error(`${keyword} value must be ${JSON.stringify(def.schemaType)}`);
          }
        }
        if ("code" in def ? def.trackErrors : def.errors !== false) {
          this.errsCount = it2.gen.const("_errs", names_1.default.errors);
        }
      }
      result(condition, successAction, failAction) {
        this.failResult((0, codegen_1.not)(condition), successAction, failAction);
      }
      failResult(condition, successAction, failAction) {
        this.gen.if(condition);
        if (failAction)
          failAction();
        else
          this.error();
        if (successAction) {
          this.gen.else();
          successAction();
          if (this.allErrors)
            this.gen.endIf();
        } else {
          if (this.allErrors)
            this.gen.endIf();
          else
            this.gen.else();
        }
      }
      pass(condition, failAction) {
        this.failResult((0, codegen_1.not)(condition), void 0, failAction);
      }
      fail(condition) {
        if (condition === void 0) {
          this.error();
          if (!this.allErrors)
            this.gen.if(false);
          return;
        }
        this.gen.if(condition);
        this.error();
        if (this.allErrors)
          this.gen.endIf();
        else
          this.gen.else();
      }
      fail$data(condition) {
        if (!this.$data)
          return this.fail(condition);
        const { schemaCode } = this;
        this.fail((0, codegen_1._)`${schemaCode} !== undefined && (${(0, codegen_1.or)(this.invalid$data(), condition)})`);
      }
      error(append, errorParams, errorPaths) {
        if (errorParams) {
          this.setParams(errorParams);
          this._error(append, errorPaths);
          this.setParams({});
          return;
        }
        this._error(append, errorPaths);
      }
      _error(append, errorPaths) {
        ;
        (append ? errors_1.reportExtraError : errors_1.reportError)(this, this.def.error, errorPaths);
      }
      $dataError() {
        (0, errors_1.reportError)(this, this.def.$dataError || errors_1.keyword$DataError);
      }
      reset() {
        if (this.errsCount === void 0)
          throw new Error('add "trackErrors" to keyword definition');
        (0, errors_1.resetErrorsCount)(this.gen, this.errsCount);
      }
      ok(cond) {
        if (!this.allErrors)
          this.gen.if(cond);
      }
      setParams(obj, assign) {
        if (assign)
          Object.assign(this.params, obj);
        else
          this.params = obj;
      }
      block$data(valid, codeBlock, $dataValid = codegen_1.nil) {
        this.gen.block(() => {
          this.check$data(valid, $dataValid);
          codeBlock();
        });
      }
      check$data(valid = codegen_1.nil, $dataValid = codegen_1.nil) {
        if (!this.$data)
          return;
        const { gen, schemaCode, schemaType, def } = this;
        gen.if((0, codegen_1.or)((0, codegen_1._)`${schemaCode} === undefined`, $dataValid));
        if (valid !== codegen_1.nil)
          gen.assign(valid, true);
        if (schemaType.length || def.validateSchema) {
          gen.elseIf(this.invalid$data());
          this.$dataError();
          if (valid !== codegen_1.nil)
            gen.assign(valid, false);
        }
        gen.else();
      }
      invalid$data() {
        const { gen, schemaCode, schemaType, def, it: it2 } = this;
        return (0, codegen_1.or)(wrong$DataType(), invalid$DataSchema());
        function wrong$DataType() {
          if (schemaType.length) {
            if (!(schemaCode instanceof codegen_1.Name))
              throw new Error("ajv implementation error");
            const st2 = Array.isArray(schemaType) ? schemaType : [schemaType];
            return (0, codegen_1._)`${(0, dataType_2.checkDataTypes)(st2, schemaCode, it2.opts.strictNumbers, dataType_2.DataType.Wrong)}`;
          }
          return codegen_1.nil;
        }
        function invalid$DataSchema() {
          if (def.validateSchema) {
            const validateSchemaRef = gen.scopeValue("validate$data", { ref: def.validateSchema });
            return (0, codegen_1._)`!${validateSchemaRef}(${schemaCode})`;
          }
          return codegen_1.nil;
        }
      }
      subschema(appl, valid) {
        const subschema = (0, subschema_1.getSubschema)(this.it, appl);
        (0, subschema_1.extendSubschemaData)(subschema, this.it, appl);
        (0, subschema_1.extendSubschemaMode)(subschema, appl);
        const nextContext = { ...this.it, ...subschema, items: void 0, props: void 0 };
        subschemaCode(nextContext, valid);
        return nextContext;
      }
      mergeEvaluated(schemaCxt, toName) {
        const { it: it2, gen } = this;
        if (!it2.opts.unevaluated)
          return;
        if (it2.props !== true && schemaCxt.props !== void 0) {
          it2.props = util_1.mergeEvaluated.props(gen, schemaCxt.props, it2.props, toName);
        }
        if (it2.items !== true && schemaCxt.items !== void 0) {
          it2.items = util_1.mergeEvaluated.items(gen, schemaCxt.items, it2.items, toName);
        }
      }
      mergeValidEvaluated(schemaCxt, valid) {
        const { it: it2, gen } = this;
        if (it2.opts.unevaluated && (it2.props !== true || it2.items !== true)) {
          gen.if(valid, () => this.mergeEvaluated(schemaCxt, codegen_1.Name));
          return true;
        }
      }
    };
    exports.KeywordCxt = KeywordCxt;
    function keywordCode(it2, keyword, def, ruleType) {
      const cxt = new KeywordCxt(it2, def, keyword);
      if ("code" in def) {
        def.code(cxt, ruleType);
      } else if (cxt.$data && def.validate) {
        (0, keyword_1.funcKeywordCode)(cxt, def);
      } else if ("macro" in def) {
        (0, keyword_1.macroKeywordCode)(cxt, def);
      } else if (def.compile || def.validate) {
        (0, keyword_1.funcKeywordCode)(cxt, def);
      }
    }
    var JSON_POINTER = /^\/(?:[^~]|~0|~1)*$/;
    var RELATIVE_JSON_POINTER = /^([0-9]+)(#|\/(?:[^~]|~0|~1)*)?$/;
    function getData($data, { dataLevel, dataNames, dataPathArr }) {
      let jsonPointer;
      let data;
      if ($data === "")
        return names_1.default.rootData;
      if ($data[0] === "/") {
        if (!JSON_POINTER.test($data))
          throw new Error(`Invalid JSON-pointer: ${$data}`);
        jsonPointer = $data;
        data = names_1.default.rootData;
      } else {
        const matches = RELATIVE_JSON_POINTER.exec($data);
        if (!matches)
          throw new Error(`Invalid JSON-pointer: ${$data}`);
        const up = +matches[1];
        jsonPointer = matches[2];
        if (jsonPointer === "#") {
          if (up >= dataLevel)
            throw new Error(errorMsg("property/index", up));
          return dataPathArr[dataLevel - up];
        }
        if (up > dataLevel)
          throw new Error(errorMsg("data", up));
        data = dataNames[dataLevel - up];
        if (!jsonPointer)
          return data;
      }
      let expr = data;
      const segments = jsonPointer.split("/");
      for (const segment of segments) {
        if (segment) {
          data = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)((0, util_1.unescapeJsonPointer)(segment))}`;
          expr = (0, codegen_1._)`${expr} && ${data}`;
        }
      }
      return expr;
      function errorMsg(pointerType, up) {
        return `Cannot access ${pointerType} ${up} levels up, current level is ${dataLevel}`;
      }
    }
    exports.getData = getData;
  }
});

// node_modules/ajv/dist/runtime/validation_error.js
var require_validation_error = __commonJS({
  "node_modules/ajv/dist/runtime/validation_error.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var ValidationError = class extends Error {
      constructor(errors) {
        super("validation failed");
        this.errors = errors;
        this.ajv = this.validation = true;
      }
    };
    exports.default = ValidationError;
  }
});

// node_modules/ajv/dist/compile/ref_error.js
var require_ref_error = __commonJS({
  "node_modules/ajv/dist/compile/ref_error.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var resolve_1 = require_resolve();
    var MissingRefError = class extends Error {
      constructor(resolver, baseId, ref, msg) {
        super(msg || `can't resolve reference ${ref} from id ${baseId}`);
        this.missingRef = (0, resolve_1.resolveUrl)(resolver, baseId, ref);
        this.missingSchema = (0, resolve_1.normalizeId)((0, resolve_1.getFullPath)(resolver, this.missingRef));
      }
    };
    exports.default = MissingRefError;
  }
});

// node_modules/ajv/dist/compile/index.js
var require_compile = __commonJS({
  "node_modules/ajv/dist/compile/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.resolveSchema = exports.getCompilingSchema = exports.resolveRef = exports.compileSchema = exports.SchemaEnv = void 0;
    var codegen_1 = require_codegen();
    var validation_error_1 = require_validation_error();
    var names_1 = require_names();
    var resolve_1 = require_resolve();
    var util_1 = require_util();
    var validate_1 = require_validate();
    var SchemaEnv = class {
      constructor(env) {
        var _a;
        this.refs = {};
        this.dynamicAnchors = {};
        let schema;
        if (typeof env.schema == "object")
          schema = env.schema;
        this.schema = env.schema;
        this.schemaId = env.schemaId;
        this.root = env.root || this;
        this.baseId = (_a = env.baseId) !== null && _a !== void 0 ? _a : (0, resolve_1.normalizeId)(schema === null || schema === void 0 ? void 0 : schema[env.schemaId || "$id"]);
        this.schemaPath = env.schemaPath;
        this.localRefs = env.localRefs;
        this.meta = env.meta;
        this.$async = schema === null || schema === void 0 ? void 0 : schema.$async;
        this.refs = {};
      }
    };
    exports.SchemaEnv = SchemaEnv;
    function compileSchema(sch) {
      const _sch = getCompilingSchema.call(this, sch);
      if (_sch)
        return _sch;
      const rootId = (0, resolve_1.getFullPath)(this.opts.uriResolver, sch.root.baseId);
      const { es5, lines } = this.opts.code;
      const { ownProperties } = this.opts;
      const gen = new codegen_1.CodeGen(this.scope, { es5, lines, ownProperties });
      let _ValidationError;
      if (sch.$async) {
        _ValidationError = gen.scopeValue("Error", {
          ref: validation_error_1.default,
          code: (0, codegen_1._)`require("ajv/dist/runtime/validation_error").default`
        });
      }
      const validateName = gen.scopeName("validate");
      sch.validateName = validateName;
      const schemaCxt = {
        gen,
        allErrors: this.opts.allErrors,
        data: names_1.default.data,
        parentData: names_1.default.parentData,
        parentDataProperty: names_1.default.parentDataProperty,
        dataNames: [names_1.default.data],
        dataPathArr: [codegen_1.nil],
        // TODO can its length be used as dataLevel if nil is removed?
        dataLevel: 0,
        dataTypes: [],
        definedProperties: /* @__PURE__ */ new Set(),
        topSchemaRef: gen.scopeValue("schema", this.opts.code.source === true ? { ref: sch.schema, code: (0, codegen_1.stringify)(sch.schema) } : { ref: sch.schema }),
        validateName,
        ValidationError: _ValidationError,
        schema: sch.schema,
        schemaEnv: sch,
        rootId,
        baseId: sch.baseId || rootId,
        schemaPath: codegen_1.nil,
        errSchemaPath: sch.schemaPath || (this.opts.jtd ? "" : "#"),
        errorPath: (0, codegen_1._)`""`,
        opts: this.opts,
        self: this
      };
      let sourceCode;
      try {
        this._compilations.add(sch);
        (0, validate_1.validateFunctionCode)(schemaCxt);
        gen.optimize(this.opts.code.optimize);
        const validateCode = gen.toString();
        sourceCode = `${gen.scopeRefs(names_1.default.scope)}return ${validateCode}`;
        if (this.opts.code.process)
          sourceCode = this.opts.code.process(sourceCode, sch);
        const makeValidate = new Function(`${names_1.default.self}`, `${names_1.default.scope}`, sourceCode);
        const validate2 = makeValidate(this, this.scope.get());
        this.scope.value(validateName, { ref: validate2 });
        validate2.errors = null;
        validate2.schema = sch.schema;
        validate2.schemaEnv = sch;
        if (sch.$async)
          validate2.$async = true;
        if (this.opts.code.source === true) {
          validate2.source = { validateName, validateCode, scopeValues: gen._values };
        }
        if (this.opts.unevaluated) {
          const { props, items } = schemaCxt;
          validate2.evaluated = {
            props: props instanceof codegen_1.Name ? void 0 : props,
            items: items instanceof codegen_1.Name ? void 0 : items,
            dynamicProps: props instanceof codegen_1.Name,
            dynamicItems: items instanceof codegen_1.Name
          };
          if (validate2.source)
            validate2.source.evaluated = (0, codegen_1.stringify)(validate2.evaluated);
        }
        sch.validate = validate2;
        return sch;
      } catch (e) {
        delete sch.validate;
        delete sch.validateName;
        if (sourceCode)
          this.logger.error("Error compiling schema, function code:", sourceCode);
        throw e;
      } finally {
        this._compilations.delete(sch);
      }
    }
    exports.compileSchema = compileSchema;
    function resolveRef(root, baseId, ref) {
      var _a;
      ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, ref);
      const schOrFunc = root.refs[ref];
      if (schOrFunc)
        return schOrFunc;
      let _sch = resolve4.call(this, root, ref);
      if (_sch === void 0) {
        const schema = (_a = root.localRefs) === null || _a === void 0 ? void 0 : _a[ref];
        const { schemaId } = this.opts;
        if (schema)
          _sch = new SchemaEnv({ schema, schemaId, root, baseId });
      }
      if (_sch === void 0)
        return;
      return root.refs[ref] = inlineOrCompile.call(this, _sch);
    }
    exports.resolveRef = resolveRef;
    function inlineOrCompile(sch) {
      if ((0, resolve_1.inlineRef)(sch.schema, this.opts.inlineRefs))
        return sch.schema;
      return sch.validate ? sch : compileSchema.call(this, sch);
    }
    function getCompilingSchema(schEnv) {
      for (const sch of this._compilations) {
        if (sameSchemaEnv(sch, schEnv))
          return sch;
      }
    }
    exports.getCompilingSchema = getCompilingSchema;
    function sameSchemaEnv(s1, s2) {
      return s1.schema === s2.schema && s1.root === s2.root && s1.baseId === s2.baseId;
    }
    function resolve4(root, ref) {
      let sch;
      while (typeof (sch = this.refs[ref]) == "string")
        ref = sch;
      return sch || this.schemas[ref] || resolveSchema.call(this, root, ref);
    }
    function resolveSchema(root, ref) {
      const p = this.opts.uriResolver.parse(ref);
      const refPath = (0, resolve_1._getFullPath)(this.opts.uriResolver, p);
      let baseId = (0, resolve_1.getFullPath)(this.opts.uriResolver, root.baseId, void 0);
      if (Object.keys(root.schema).length > 0 && refPath === baseId) {
        return getJsonPointer.call(this, p, root);
      }
      const id = (0, resolve_1.normalizeId)(refPath);
      const schOrRef = this.refs[id] || this.schemas[id];
      if (typeof schOrRef == "string") {
        const sch = resolveSchema.call(this, root, schOrRef);
        if (typeof (sch === null || sch === void 0 ? void 0 : sch.schema) !== "object")
          return;
        return getJsonPointer.call(this, p, sch);
      }
      if (typeof (schOrRef === null || schOrRef === void 0 ? void 0 : schOrRef.schema) !== "object")
        return;
      if (!schOrRef.validate)
        compileSchema.call(this, schOrRef);
      if (id === (0, resolve_1.normalizeId)(ref)) {
        const { schema } = schOrRef;
        const { schemaId } = this.opts;
        const schId = schema[schemaId];
        if (schId)
          baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId);
        return new SchemaEnv({ schema, schemaId, root, baseId });
      }
      return getJsonPointer.call(this, p, schOrRef);
    }
    exports.resolveSchema = resolveSchema;
    var PREVENT_SCOPE_CHANGE = /* @__PURE__ */ new Set([
      "properties",
      "patternProperties",
      "enum",
      "dependencies",
      "definitions"
    ]);
    function getJsonPointer(parsedRef, { baseId, schema, root }) {
      var _a;
      if (((_a = parsedRef.fragment) === null || _a === void 0 ? void 0 : _a[0]) !== "/")
        return;
      for (const part of parsedRef.fragment.slice(1).split("/")) {
        if (typeof schema === "boolean")
          return;
        const partSchema = schema[(0, util_1.unescapeFragment)(part)];
        if (partSchema === void 0)
          return;
        schema = partSchema;
        const schId = typeof schema === "object" && schema[this.opts.schemaId];
        if (!PREVENT_SCOPE_CHANGE.has(part) && schId) {
          baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId);
        }
      }
      let env;
      if (typeof schema != "boolean" && schema.$ref && !(0, util_1.schemaHasRulesButRef)(schema, this.RULES)) {
        const $ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schema.$ref);
        env = resolveSchema.call(this, root, $ref);
      }
      const { schemaId } = this.opts;
      env = env || new SchemaEnv({ schema, schemaId, root, baseId });
      if (env.schema !== env.root.schema)
        return env;
      return void 0;
    }
  }
});

// node_modules/ajv/dist/refs/data.json
var require_data = __commonJS({
  "node_modules/ajv/dist/refs/data.json"(exports, module) {
    module.exports = {
      $id: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#",
      description: "Meta-schema for $data reference (JSON AnySchema extension proposal)",
      type: "object",
      required: ["$data"],
      properties: {
        $data: {
          type: "string",
          anyOf: [{ format: "relative-json-pointer" }, { format: "json-pointer" }]
        }
      },
      additionalProperties: false
    };
  }
});

// node_modules/fast-uri/lib/utils.js
var require_utils = __commonJS({
  "node_modules/fast-uri/lib/utils.js"(exports, module) {
    "use strict";
    var isUUID = RegExp.prototype.test.bind(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu);
    var isIPv4 = RegExp.prototype.test.bind(/^(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)$/u);
    var isHexPair = RegExp.prototype.test.bind(/^[\da-f]{2}$/iu);
    var isUnreserved = RegExp.prototype.test.bind(/^[\da-z\-._~]$/iu);
    var isPathCharacter = RegExp.prototype.test.bind(/^[\da-z\-._~!$&'()*+,;=:@/]$/iu);
    function stringArrayToHexStripped(input) {
      let acc = "";
      let code = 0;
      let i = 0;
      for (i = 0; i < input.length; i++) {
        code = input[i].charCodeAt(0);
        if (code === 48) {
          continue;
        }
        if (!(code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102)) {
          return "";
        }
        acc += input[i];
        break;
      }
      for (i += 1; i < input.length; i++) {
        code = input[i].charCodeAt(0);
        if (!(code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102)) {
          return "";
        }
        acc += input[i];
      }
      return acc;
    }
    var nonSimpleDomain = RegExp.prototype.test.bind(/[^!"$&'()*+,\-.;=_`a-z{}~]/u);
    function consumeIsZone(buffer) {
      buffer.length = 0;
      return true;
    }
    function consumeHextets(buffer, address, output) {
      if (buffer.length) {
        const hex = stringArrayToHexStripped(buffer);
        if (hex !== "") {
          address.push(hex);
        } else {
          output.error = true;
          return false;
        }
        buffer.length = 0;
      }
      return true;
    }
    function getIPV6(input) {
      let tokenCount = 0;
      const output = { error: false, address: "", zone: "" };
      const address = [];
      const buffer = [];
      let endipv6Encountered = false;
      let endIpv6 = false;
      let consume = consumeHextets;
      for (let i = 0; i < input.length; i++) {
        const cursor = input[i];
        if (cursor === "[" || cursor === "]") {
          continue;
        }
        if (cursor === ":") {
          if (endipv6Encountered === true) {
            endIpv6 = true;
          }
          if (!consume(buffer, address, output)) {
            break;
          }
          if (++tokenCount > 7) {
            output.error = true;
            break;
          }
          if (i > 0 && input[i - 1] === ":") {
            endipv6Encountered = true;
          }
          address.push(":");
          continue;
        } else if (cursor === "%") {
          if (!consume(buffer, address, output)) {
            break;
          }
          consume = consumeIsZone;
        } else {
          buffer.push(cursor);
          continue;
        }
      }
      if (buffer.length) {
        if (consume === consumeIsZone) {
          output.zone = buffer.join("");
        } else if (endIpv6) {
          address.push(buffer.join(""));
        } else {
          address.push(stringArrayToHexStripped(buffer));
        }
      }
      output.address = address.join("");
      return output;
    }
    function normalizeIPv6(host) {
      if (findToken(host, ":") < 2) {
        return { host, isIPV6: false };
      }
      const ipv6 = getIPV6(host);
      if (!ipv6.error) {
        let newHost = ipv6.address;
        let escapedHost = ipv6.address;
        if (ipv6.zone) {
          newHost += "%" + ipv6.zone;
          escapedHost += "%25" + ipv6.zone;
        }
        return { host: newHost, isIPV6: true, escapedHost };
      } else {
        return { host, isIPV6: false };
      }
    }
    function findToken(str, token) {
      let ind = 0;
      for (let i = 0; i < str.length; i++) {
        if (str[i] === token) ind++;
      }
      return ind;
    }
    function removeDotSegments(path) {
      let input = path;
      const output = [];
      let nextSlash = -1;
      let len = 0;
      while (len = input.length) {
        if (len === 1) {
          if (input === ".") {
            break;
          } else if (input === "/") {
            output.push("/");
            break;
          } else {
            output.push(input);
            break;
          }
        } else if (len === 2) {
          if (input[0] === ".") {
            if (input[1] === ".") {
              break;
            } else if (input[1] === "/") {
              input = input.slice(2);
              continue;
            }
          } else if (input[0] === "/") {
            if (input[1] === "." || input[1] === "/") {
              output.push("/");
              break;
            }
          }
        } else if (len === 3) {
          if (input === "/..") {
            if (output.length !== 0) {
              output.pop();
            }
            output.push("/");
            break;
          }
        }
        if (input[0] === ".") {
          if (input[1] === ".") {
            if (input[2] === "/") {
              input = input.slice(3);
              continue;
            }
          } else if (input[1] === "/") {
            input = input.slice(2);
            continue;
          }
        } else if (input[0] === "/") {
          if (input[1] === ".") {
            if (input[2] === "/") {
              input = input.slice(2);
              continue;
            } else if (input[2] === ".") {
              if (input[3] === "/") {
                input = input.slice(3);
                if (output.length !== 0) {
                  output.pop();
                }
                continue;
              }
            }
          }
        }
        if ((nextSlash = input.indexOf("/", 1)) === -1) {
          output.push(input);
          break;
        } else {
          output.push(input.slice(0, nextSlash));
          input = input.slice(nextSlash);
        }
      }
      return output.join("");
    }
    var HOST_DELIMS = { "@": "%40", "/": "%2F", "?": "%3F", "#": "%23", ":": "%3A" };
    var HOST_DELIM_RE = /[@/?#:]/g;
    var HOST_DELIM_NO_COLON_RE = /[@/?#]/g;
    function reescapeHostDelimiters(host, isIP) {
      const re2 = isIP ? HOST_DELIM_NO_COLON_RE : HOST_DELIM_RE;
      re2.lastIndex = 0;
      return host.replace(re2, (ch) => HOST_DELIMS[ch]);
    }
    function normalizePercentEncoding(input, decodeUnreserved = false) {
      if (input.indexOf("%") === -1) {
        return input;
      }
      let output = "";
      for (let i = 0; i < input.length; i++) {
        if (input[i] === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            const normalizedHex = hex.toUpperCase();
            const decoded = String.fromCharCode(parseInt(normalizedHex, 16));
            if (decodeUnreserved && isUnreserved(decoded)) {
              output += decoded;
            } else {
              output += "%" + normalizedHex;
            }
            i += 2;
            continue;
          }
        }
        output += input[i];
      }
      return output;
    }
    function normalizePathEncoding(input) {
      let output = "";
      for (let i = 0; i < input.length; i++) {
        if (input[i] === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            const normalizedHex = hex.toUpperCase();
            const decoded = String.fromCharCode(parseInt(normalizedHex, 16));
            if (decoded !== "." && isUnreserved(decoded)) {
              output += decoded;
            } else {
              output += "%" + normalizedHex;
            }
            i += 2;
            continue;
          }
        }
        if (isPathCharacter(input[i])) {
          output += input[i];
        } else {
          output += escape(input[i]);
        }
      }
      return output;
    }
    function escapePreservingEscapes(input) {
      let output = "";
      for (let i = 0; i < input.length; i++) {
        if (input[i] === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            output += "%" + hex.toUpperCase();
            i += 2;
            continue;
          }
        }
        output += escape(input[i]);
      }
      return output;
    }
    function recomposeAuthority(component) {
      const uriTokens = [];
      if (component.userinfo !== void 0) {
        uriTokens.push(component.userinfo);
        uriTokens.push("@");
      }
      if (component.host !== void 0) {
        let host = unescape(component.host);
        if (!isIPv4(host)) {
          const ipV6res = normalizeIPv6(host);
          if (ipV6res.isIPV6 === true) {
            host = `[${ipV6res.escapedHost}]`;
          } else {
            host = reescapeHostDelimiters(host, false);
          }
        }
        uriTokens.push(host);
      }
      if (typeof component.port === "number" || typeof component.port === "string") {
        uriTokens.push(":");
        uriTokens.push(String(component.port));
      }
      return uriTokens.length ? uriTokens.join("") : void 0;
    }
    module.exports = {
      nonSimpleDomain,
      recomposeAuthority,
      reescapeHostDelimiters,
      normalizePercentEncoding,
      normalizePathEncoding,
      escapePreservingEscapes,
      removeDotSegments,
      isIPv4,
      isUUID,
      normalizeIPv6,
      stringArrayToHexStripped
    };
  }
});

// node_modules/fast-uri/lib/schemes.js
var require_schemes = __commonJS({
  "node_modules/fast-uri/lib/schemes.js"(exports, module) {
    "use strict";
    var { isUUID } = require_utils();
    var URN_REG = /([\da-z][\d\-a-z]{0,31}):((?:[\w!$'()*+,\-.:;=@]|%[\da-f]{2})+)/iu;
    var supportedSchemeNames = (
      /** @type {const} */
      [
        "http",
        "https",
        "ws",
        "wss",
        "urn",
        "urn:uuid"
      ]
    );
    function isValidSchemeName(name) {
      return supportedSchemeNames.indexOf(
        /** @type {*} */
        name
      ) !== -1;
    }
    function wsIsSecure(wsComponent) {
      if (wsComponent.secure === true) {
        return true;
      } else if (wsComponent.secure === false) {
        return false;
      } else if (wsComponent.scheme) {
        return wsComponent.scheme.length === 3 && (wsComponent.scheme[0] === "w" || wsComponent.scheme[0] === "W") && (wsComponent.scheme[1] === "s" || wsComponent.scheme[1] === "S") && (wsComponent.scheme[2] === "s" || wsComponent.scheme[2] === "S");
      } else {
        return false;
      }
    }
    function httpParse(component) {
      if (!component.host) {
        component.error = component.error || "HTTP URIs must have a host.";
      }
      return component;
    }
    function httpSerialize(component) {
      const secure = String(component.scheme).toLowerCase() === "https";
      if (component.port === (secure ? 443 : 80) || component.port === "") {
        component.port = void 0;
      }
      if (!component.path) {
        component.path = "/";
      }
      return component;
    }
    function wsParse(wsComponent) {
      wsComponent.secure = wsIsSecure(wsComponent);
      wsComponent.resourceName = (wsComponent.path || "/") + (wsComponent.query ? "?" + wsComponent.query : "");
      wsComponent.path = void 0;
      wsComponent.query = void 0;
      return wsComponent;
    }
    function wsSerialize(wsComponent) {
      if (wsComponent.port === (wsIsSecure(wsComponent) ? 443 : 80) || wsComponent.port === "") {
        wsComponent.port = void 0;
      }
      if (typeof wsComponent.secure === "boolean") {
        wsComponent.scheme = wsComponent.secure ? "wss" : "ws";
        wsComponent.secure = void 0;
      }
      if (wsComponent.resourceName) {
        const [path, query] = wsComponent.resourceName.split("?");
        wsComponent.path = path && path !== "/" ? path : void 0;
        wsComponent.query = query;
        wsComponent.resourceName = void 0;
      }
      wsComponent.fragment = void 0;
      return wsComponent;
    }
    function urnParse(urnComponent, options) {
      if (!urnComponent.path) {
        urnComponent.error = "URN can not be parsed";
        return urnComponent;
      }
      const matches = urnComponent.path.match(URN_REG);
      if (matches) {
        const scheme = options.scheme || urnComponent.scheme || "urn";
        urnComponent.nid = matches[1].toLowerCase();
        urnComponent.nss = matches[2];
        const urnScheme = `${scheme}:${options.nid || urnComponent.nid}`;
        const schemeHandler = getSchemeHandler(urnScheme);
        urnComponent.path = void 0;
        if (schemeHandler) {
          urnComponent = schemeHandler.parse(urnComponent, options);
        }
      } else {
        urnComponent.error = urnComponent.error || "URN can not be parsed.";
      }
      return urnComponent;
    }
    function urnSerialize(urnComponent, options) {
      if (urnComponent.nid === void 0) {
        throw new Error("URN without nid cannot be serialized");
      }
      const scheme = options.scheme || urnComponent.scheme || "urn";
      const nid = urnComponent.nid.toLowerCase();
      const urnScheme = `${scheme}:${options.nid || nid}`;
      const schemeHandler = getSchemeHandler(urnScheme);
      if (schemeHandler) {
        urnComponent = schemeHandler.serialize(urnComponent, options);
      }
      const uriComponent = urnComponent;
      const nss = urnComponent.nss;
      uriComponent.path = `${nid || options.nid}:${nss}`;
      options.skipEscape = true;
      return uriComponent;
    }
    function urnuuidParse(urnComponent, options) {
      const uuidComponent = urnComponent;
      uuidComponent.uuid = uuidComponent.nss;
      uuidComponent.nss = void 0;
      if (!options.tolerant && (!uuidComponent.uuid || !isUUID(uuidComponent.uuid))) {
        uuidComponent.error = uuidComponent.error || "UUID is not valid.";
      }
      return uuidComponent;
    }
    function urnuuidSerialize(uuidComponent) {
      const urnComponent = uuidComponent;
      urnComponent.nss = (uuidComponent.uuid || "").toLowerCase();
      return urnComponent;
    }
    var http = (
      /** @type {SchemeHandler} */
      {
        scheme: "http",
        domainHost: true,
        parse: httpParse,
        serialize: httpSerialize
      }
    );
    var https = (
      /** @type {SchemeHandler} */
      {
        scheme: "https",
        domainHost: http.domainHost,
        parse: httpParse,
        serialize: httpSerialize
      }
    );
    var ws = (
      /** @type {SchemeHandler} */
      {
        scheme: "ws",
        domainHost: true,
        parse: wsParse,
        serialize: wsSerialize
      }
    );
    var wss = (
      /** @type {SchemeHandler} */
      {
        scheme: "wss",
        domainHost: ws.domainHost,
        parse: ws.parse,
        serialize: ws.serialize
      }
    );
    var urn = (
      /** @type {SchemeHandler} */
      {
        scheme: "urn",
        parse: urnParse,
        serialize: urnSerialize,
        skipNormalize: true
      }
    );
    var urnuuid = (
      /** @type {SchemeHandler} */
      {
        scheme: "urn:uuid",
        parse: urnuuidParse,
        serialize: urnuuidSerialize,
        skipNormalize: true
      }
    );
    var SCHEMES = (
      /** @type {Record<SchemeName, SchemeHandler>} */
      {
        http,
        https,
        ws,
        wss,
        urn,
        "urn:uuid": urnuuid
      }
    );
    Object.setPrototypeOf(SCHEMES, null);
    function getSchemeHandler(scheme) {
      return scheme && (SCHEMES[
        /** @type {SchemeName} */
        scheme
      ] || SCHEMES[
        /** @type {SchemeName} */
        scheme.toLowerCase()
      ]) || void 0;
    }
    module.exports = {
      wsIsSecure,
      SCHEMES,
      isValidSchemeName,
      getSchemeHandler
    };
  }
});

// node_modules/fast-uri/index.js
var require_fast_uri = __commonJS({
  "node_modules/fast-uri/index.js"(exports, module) {
    "use strict";
    var { normalizeIPv6, removeDotSegments, recomposeAuthority, normalizePercentEncoding, normalizePathEncoding, escapePreservingEscapes, reescapeHostDelimiters, isIPv4, nonSimpleDomain } = require_utils();
    var { SCHEMES, getSchemeHandler } = require_schemes();
    function normalize(uri, options) {
      if (typeof uri === "string") {
        uri = /** @type {T} */
        normalizeString(uri, options);
      } else if (typeof uri === "object") {
        uri = /** @type {T} */
        parse2(serialize(uri, options), options);
      }
      return uri;
    }
    function resolve4(baseURI, relativeURI, options) {
      const schemelessOptions = options ? Object.assign({ scheme: "null" }, options) : { scheme: "null" };
      const resolved = resolveComponent(parse2(baseURI, schemelessOptions), parse2(relativeURI, schemelessOptions), schemelessOptions, true);
      schemelessOptions.skipEscape = true;
      return serialize(resolved, schemelessOptions);
    }
    function resolveComponent(base, relative2, options, skipNormalization) {
      const target = {};
      if (!skipNormalization) {
        base = parse2(serialize(base, options), options);
        relative2 = parse2(serialize(relative2, options), options);
      }
      options = options || {};
      if (!options.tolerant && relative2.scheme) {
        target.scheme = relative2.scheme;
        target.userinfo = relative2.userinfo;
        target.host = relative2.host;
        target.port = relative2.port;
        target.path = removeDotSegments(relative2.path || "");
        target.query = relative2.query;
      } else {
        if (relative2.userinfo !== void 0 || relative2.host !== void 0 || relative2.port !== void 0) {
          target.userinfo = relative2.userinfo;
          target.host = relative2.host;
          target.port = relative2.port;
          target.path = removeDotSegments(relative2.path || "");
          target.query = relative2.query;
        } else {
          if (!relative2.path) {
            target.path = base.path;
            if (relative2.query !== void 0) {
              target.query = relative2.query;
            } else {
              target.query = base.query;
            }
          } else {
            if (relative2.path[0] === "/") {
              target.path = removeDotSegments(relative2.path);
            } else {
              if ((base.userinfo !== void 0 || base.host !== void 0 || base.port !== void 0) && !base.path) {
                target.path = "/" + relative2.path;
              } else if (!base.path) {
                target.path = relative2.path;
              } else {
                target.path = base.path.slice(0, base.path.lastIndexOf("/") + 1) + relative2.path;
              }
              target.path = removeDotSegments(target.path);
            }
            target.query = relative2.query;
          }
          target.userinfo = base.userinfo;
          target.host = base.host;
          target.port = base.port;
        }
        target.scheme = base.scheme;
      }
      target.fragment = relative2.fragment;
      return target;
    }
    function equal(uriA, uriB, options) {
      const normalizedA = normalizeComparableURI(uriA, options);
      const normalizedB = normalizeComparableURI(uriB, options);
      return normalizedA !== void 0 && normalizedB !== void 0 && normalizedA.toLowerCase() === normalizedB.toLowerCase();
    }
    function serialize(cmpts, opts) {
      const component = {
        host: cmpts.host,
        scheme: cmpts.scheme,
        userinfo: cmpts.userinfo,
        port: cmpts.port,
        path: cmpts.path,
        query: cmpts.query,
        nid: cmpts.nid,
        nss: cmpts.nss,
        uuid: cmpts.uuid,
        fragment: cmpts.fragment,
        reference: cmpts.reference,
        resourceName: cmpts.resourceName,
        secure: cmpts.secure,
        error: ""
      };
      const options = Object.assign({}, opts);
      const uriTokens = [];
      const schemeHandler = getSchemeHandler(options.scheme || component.scheme);
      if (schemeHandler && schemeHandler.serialize) schemeHandler.serialize(component, options);
      if (component.path !== void 0) {
        if (!options.skipEscape) {
          component.path = escapePreservingEscapes(component.path);
          if (component.scheme !== void 0) {
            component.path = component.path.split("%3A").join(":");
          }
        } else {
          component.path = normalizePercentEncoding(component.path);
        }
      }
      if (options.reference !== "suffix" && component.scheme) {
        uriTokens.push(component.scheme, ":");
      }
      const authority = recomposeAuthority(component);
      if (authority !== void 0) {
        if (options.reference !== "suffix") {
          uriTokens.push("//");
        }
        uriTokens.push(authority);
        if (component.path && component.path[0] !== "/") {
          uriTokens.push("/");
        }
      }
      if (component.path !== void 0) {
        let s = component.path;
        if (!options.absolutePath && (!schemeHandler || !schemeHandler.absolutePath)) {
          s = removeDotSegments(s);
        }
        if (authority === void 0 && s[0] === "/" && s[1] === "/") {
          s = "/%2F" + s.slice(2);
        }
        uriTokens.push(s);
      }
      if (component.query !== void 0) {
        uriTokens.push("?", component.query);
      }
      if (component.fragment !== void 0) {
        uriTokens.push("#", component.fragment);
      }
      return uriTokens.join("");
    }
    var URI_PARSE = /^(?:([^#/:?]+):)?(?:\/\/((?:([^#/?@]*)@)?(\[[^#/?\]]+\]|[^#/:?]*)(?::(\d*))?))?([^#?]*)(?:\?([^#]*))?(?:#((?:.|[\n\r])*))?/u;
    function getParseError(parsed, matches) {
      if (matches[2] !== void 0 && parsed.path && parsed.path[0] !== "/") {
        return 'URI path must start with "/" when authority is present.';
      }
      if (typeof parsed.port === "number" && (parsed.port < 0 || parsed.port > 65535)) {
        return "URI port is malformed.";
      }
      return void 0;
    }
    function parseWithStatus(uri, opts) {
      const options = Object.assign({}, opts);
      const parsed = {
        scheme: void 0,
        userinfo: void 0,
        host: "",
        port: void 0,
        path: "",
        query: void 0,
        fragment: void 0
      };
      let malformedAuthorityOrPort = false;
      let isIP = false;
      if (options.reference === "suffix") {
        if (options.scheme) {
          uri = options.scheme + ":" + uri;
        } else {
          uri = "//" + uri;
        }
      }
      const matches = uri.match(URI_PARSE);
      if (matches) {
        parsed.scheme = matches[1];
        parsed.userinfo = matches[3];
        parsed.host = matches[4];
        parsed.port = parseInt(matches[5], 10);
        parsed.path = matches[6] || "";
        parsed.query = matches[7];
        parsed.fragment = matches[8];
        if (isNaN(parsed.port)) {
          parsed.port = matches[5];
        }
        const parseError = getParseError(parsed, matches);
        if (parseError !== void 0) {
          parsed.error = parsed.error || parseError;
          malformedAuthorityOrPort = true;
        }
        if (parsed.host) {
          const ipv4result = isIPv4(parsed.host);
          if (ipv4result === false) {
            const ipv6result = normalizeIPv6(parsed.host);
            parsed.host = ipv6result.host.toLowerCase();
            isIP = ipv6result.isIPV6;
          } else {
            isIP = true;
          }
        }
        if (parsed.scheme === void 0 && parsed.userinfo === void 0 && parsed.host === void 0 && parsed.port === void 0 && parsed.query === void 0 && !parsed.path) {
          parsed.reference = "same-document";
        } else if (parsed.scheme === void 0) {
          parsed.reference = "relative";
        } else if (parsed.fragment === void 0) {
          parsed.reference = "absolute";
        } else {
          parsed.reference = "uri";
        }
        if (options.reference && options.reference !== "suffix" && options.reference !== parsed.reference) {
          parsed.error = parsed.error || "URI is not a " + options.reference + " reference.";
        }
        const schemeHandler = getSchemeHandler(options.scheme || parsed.scheme);
        if (!options.unicodeSupport && (!schemeHandler || !schemeHandler.unicodeSupport)) {
          if (parsed.host && (options.domainHost || schemeHandler && schemeHandler.domainHost) && isIP === false && nonSimpleDomain(parsed.host)) {
            try {
              parsed.host = new URL("http://" + parsed.host).hostname;
            } catch (e) {
              parsed.error = parsed.error || "Host's domain name can not be converted to ASCII: " + e;
            }
          }
        }
        if (!schemeHandler || schemeHandler && !schemeHandler.skipNormalize) {
          if (uri.indexOf("%") !== -1) {
            if (parsed.scheme !== void 0) {
              parsed.scheme = unescape(parsed.scheme);
            }
            if (parsed.host !== void 0) {
              parsed.host = reescapeHostDelimiters(unescape(parsed.host), isIP);
            }
          }
          if (parsed.path) {
            parsed.path = normalizePathEncoding(parsed.path);
          }
          if (parsed.fragment) {
            try {
              parsed.fragment = encodeURI(decodeURIComponent(parsed.fragment));
            } catch {
              parsed.error = parsed.error || "URI malformed";
            }
          }
        }
        if (schemeHandler && schemeHandler.parse) {
          schemeHandler.parse(parsed, options);
        }
      } else {
        parsed.error = parsed.error || "URI can not be parsed.";
      }
      return { parsed, malformedAuthorityOrPort };
    }
    function parse2(uri, opts) {
      return parseWithStatus(uri, opts).parsed;
    }
    function normalizeString(uri, opts) {
      return normalizeStringWithStatus(uri, opts).normalized;
    }
    function normalizeStringWithStatus(uri, opts) {
      const { parsed, malformedAuthorityOrPort } = parseWithStatus(uri, opts);
      return {
        normalized: malformedAuthorityOrPort ? uri : serialize(parsed, opts),
        malformedAuthorityOrPort
      };
    }
    function normalizeComparableURI(uri, opts) {
      if (typeof uri === "string") {
        const { normalized, malformedAuthorityOrPort } = normalizeStringWithStatus(uri, opts);
        return malformedAuthorityOrPort ? void 0 : normalized;
      }
      if (typeof uri === "object") {
        return serialize(uri, opts);
      }
    }
    var fastUri = {
      SCHEMES,
      normalize,
      resolve: resolve4,
      resolveComponent,
      equal,
      serialize,
      parse: parse2
    };
    module.exports = fastUri;
    module.exports.default = fastUri;
    module.exports.fastUri = fastUri;
  }
});

// node_modules/ajv/dist/runtime/uri.js
var require_uri = __commonJS({
  "node_modules/ajv/dist/runtime/uri.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var uri = require_fast_uri();
    uri.code = 'require("ajv/dist/runtime/uri").default';
    exports.default = uri;
  }
});

// node_modules/ajv/dist/core.js
var require_core = __commonJS({
  "node_modules/ajv/dist/core.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = void 0;
    var validate_1 = require_validate();
    Object.defineProperty(exports, "KeywordCxt", { enumerable: true, get: function() {
      return validate_1.KeywordCxt;
    } });
    var codegen_1 = require_codegen();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return codegen_1._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return codegen_1.str;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return codegen_1.stringify;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return codegen_1.nil;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return codegen_1.Name;
    } });
    Object.defineProperty(exports, "CodeGen", { enumerable: true, get: function() {
      return codegen_1.CodeGen;
    } });
    var validation_error_1 = require_validation_error();
    var ref_error_1 = require_ref_error();
    var rules_1 = require_rules();
    var compile_1 = require_compile();
    var codegen_2 = require_codegen();
    var resolve_1 = require_resolve();
    var dataType_1 = require_dataType();
    var util_1 = require_util();
    var $dataRefSchema = require_data();
    var uri_1 = require_uri();
    var defaultRegExp = (str, flags) => new RegExp(str, flags);
    defaultRegExp.code = "new RegExp";
    var META_IGNORE_OPTIONS = ["removeAdditional", "useDefaults", "coerceTypes"];
    var EXT_SCOPE_NAMES = /* @__PURE__ */ new Set([
      "validate",
      "serialize",
      "parse",
      "wrapper",
      "root",
      "schema",
      "keyword",
      "pattern",
      "formats",
      "validate$data",
      "func",
      "obj",
      "Error"
    ]);
    var removedOptions = {
      errorDataPath: "",
      format: "`validateFormats: false` can be used instead.",
      nullable: '"nullable" keyword is supported by default.',
      jsonPointers: "Deprecated jsPropertySyntax can be used instead.",
      extendRefs: "Deprecated ignoreKeywordsWithRef can be used instead.",
      missingRefs: "Pass empty schema with $id that should be ignored to ajv.addSchema.",
      processCode: "Use option `code: {process: (code, schemaEnv: object) => string}`",
      sourceCode: "Use option `code: {source: true}`",
      strictDefaults: "It is default now, see option `strict`.",
      strictKeywords: "It is default now, see option `strict`.",
      uniqueItems: '"uniqueItems" keyword is always validated.',
      unknownFormats: "Disable strict mode or pass `true` to `ajv.addFormat` (or `formats` option).",
      cache: "Map is used as cache, schema object as key.",
      serialize: "Map is used as cache, schema object as key.",
      ajvErrors: "It is default now."
    };
    var deprecatedOptions = {
      ignoreKeywordsWithRef: "",
      jsPropertySyntax: "",
      unicode: '"minLength"/"maxLength" account for unicode characters by default.'
    };
    var MAX_EXPRESSION = 200;
    function requiredOptions(o) {
      var _a, _b, _c, _d, _e2, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t2, _u, _v, _w, _x, _y, _z, _0;
      const s = o.strict;
      const _optz = (_a = o.code) === null || _a === void 0 ? void 0 : _a.optimize;
      const optimize = _optz === true || _optz === void 0 ? 1 : _optz || 0;
      const regExp = (_c = (_b = o.code) === null || _b === void 0 ? void 0 : _b.regExp) !== null && _c !== void 0 ? _c : defaultRegExp;
      const uriResolver = (_d = o.uriResolver) !== null && _d !== void 0 ? _d : uri_1.default;
      return {
        strictSchema: (_f = (_e2 = o.strictSchema) !== null && _e2 !== void 0 ? _e2 : s) !== null && _f !== void 0 ? _f : true,
        strictNumbers: (_h = (_g = o.strictNumbers) !== null && _g !== void 0 ? _g : s) !== null && _h !== void 0 ? _h : true,
        strictTypes: (_k = (_j = o.strictTypes) !== null && _j !== void 0 ? _j : s) !== null && _k !== void 0 ? _k : "log",
        strictTuples: (_m = (_l = o.strictTuples) !== null && _l !== void 0 ? _l : s) !== null && _m !== void 0 ? _m : "log",
        strictRequired: (_p = (_o = o.strictRequired) !== null && _o !== void 0 ? _o : s) !== null && _p !== void 0 ? _p : false,
        code: o.code ? { ...o.code, optimize, regExp } : { optimize, regExp },
        loopRequired: (_q = o.loopRequired) !== null && _q !== void 0 ? _q : MAX_EXPRESSION,
        loopEnum: (_r = o.loopEnum) !== null && _r !== void 0 ? _r : MAX_EXPRESSION,
        meta: (_s = o.meta) !== null && _s !== void 0 ? _s : true,
        messages: (_t2 = o.messages) !== null && _t2 !== void 0 ? _t2 : true,
        inlineRefs: (_u = o.inlineRefs) !== null && _u !== void 0 ? _u : true,
        schemaId: (_v = o.schemaId) !== null && _v !== void 0 ? _v : "$id",
        addUsedSchema: (_w = o.addUsedSchema) !== null && _w !== void 0 ? _w : true,
        validateSchema: (_x = o.validateSchema) !== null && _x !== void 0 ? _x : true,
        validateFormats: (_y = o.validateFormats) !== null && _y !== void 0 ? _y : true,
        unicodeRegExp: (_z = o.unicodeRegExp) !== null && _z !== void 0 ? _z : true,
        int32range: (_0 = o.int32range) !== null && _0 !== void 0 ? _0 : true,
        uriResolver
      };
    }
    var Ajv = class {
      constructor(opts = {}) {
        this.schemas = {};
        this.refs = {};
        this.formats = /* @__PURE__ */ Object.create(null);
        this._compilations = /* @__PURE__ */ new Set();
        this._loading = {};
        this._cache = /* @__PURE__ */ new Map();
        opts = this.opts = { ...opts, ...requiredOptions(opts) };
        const { es5, lines } = this.opts.code;
        this.scope = new codegen_2.ValueScope({ scope: {}, prefixes: EXT_SCOPE_NAMES, es5, lines });
        this.logger = getLogger(opts.logger);
        const formatOpt = opts.validateFormats;
        opts.validateFormats = false;
        this.RULES = (0, rules_1.getRules)();
        checkOptions.call(this, removedOptions, opts, "NOT SUPPORTED");
        checkOptions.call(this, deprecatedOptions, opts, "DEPRECATED", "warn");
        this._metaOpts = getMetaSchemaOptions.call(this);
        if (opts.formats)
          addInitialFormats.call(this);
        this._addVocabularies();
        this._addDefaultMetaSchema();
        if (opts.keywords)
          addInitialKeywords.call(this, opts.keywords);
        if (typeof opts.meta == "object")
          this.addMetaSchema(opts.meta);
        addInitialSchemas.call(this);
        opts.validateFormats = formatOpt;
      }
      _addVocabularies() {
        this.addKeyword("$async");
      }
      _addDefaultMetaSchema() {
        const { $data, meta, schemaId } = this.opts;
        let _dataRefSchema = $dataRefSchema;
        if (schemaId === "id") {
          _dataRefSchema = { ...$dataRefSchema };
          _dataRefSchema.id = _dataRefSchema.$id;
          delete _dataRefSchema.$id;
        }
        if (meta && $data)
          this.addMetaSchema(_dataRefSchema, _dataRefSchema[schemaId], false);
      }
      defaultMeta() {
        const { meta, schemaId } = this.opts;
        return this.opts.defaultMeta = typeof meta == "object" ? meta[schemaId] || meta : void 0;
      }
      validate(schemaKeyRef, data) {
        let v;
        if (typeof schemaKeyRef == "string") {
          v = this.getSchema(schemaKeyRef);
          if (!v)
            throw new Error(`no schema with key or ref "${schemaKeyRef}"`);
        } else {
          v = this.compile(schemaKeyRef);
        }
        const valid = v(data);
        if (!("$async" in v))
          this.errors = v.errors;
        return valid;
      }
      compile(schema, _meta) {
        const sch = this._addSchema(schema, _meta);
        return sch.validate || this._compileSchemaEnv(sch);
      }
      compileAsync(schema, meta) {
        if (typeof this.opts.loadSchema != "function") {
          throw new Error("options.loadSchema should be a function");
        }
        const { loadSchema } = this.opts;
        return runCompileAsync.call(this, schema, meta);
        async function runCompileAsync(_schema, _meta) {
          await loadMetaSchema.call(this, _schema.$schema);
          const sch = this._addSchema(_schema, _meta);
          return sch.validate || _compileAsync.call(this, sch);
        }
        async function loadMetaSchema($ref) {
          if ($ref && !this.getSchema($ref)) {
            await runCompileAsync.call(this, { $ref }, true);
          }
        }
        async function _compileAsync(sch) {
          try {
            return this._compileSchemaEnv(sch);
          } catch (e) {
            if (!(e instanceof ref_error_1.default))
              throw e;
            checkLoaded.call(this, e);
            await loadMissingSchema.call(this, e.missingSchema);
            return _compileAsync.call(this, sch);
          }
        }
        function checkLoaded({ missingSchema: ref, missingRef }) {
          if (this.refs[ref]) {
            throw new Error(`AnySchema ${ref} is loaded but ${missingRef} cannot be resolved`);
          }
        }
        async function loadMissingSchema(ref) {
          const _schema = await _loadSchema.call(this, ref);
          if (!this.refs[ref])
            await loadMetaSchema.call(this, _schema.$schema);
          if (!this.refs[ref])
            this.addSchema(_schema, ref, meta);
        }
        async function _loadSchema(ref) {
          const p = this._loading[ref];
          if (p)
            return p;
          try {
            return await (this._loading[ref] = loadSchema(ref));
          } finally {
            delete this._loading[ref];
          }
        }
      }
      // Adds schema to the instance
      addSchema(schema, key, _meta, _validateSchema = this.opts.validateSchema) {
        if (Array.isArray(schema)) {
          for (const sch of schema)
            this.addSchema(sch, void 0, _meta, _validateSchema);
          return this;
        }
        let id;
        if (typeof schema === "object") {
          const { schemaId } = this.opts;
          id = schema[schemaId];
          if (id !== void 0 && typeof id != "string") {
            throw new Error(`schema ${schemaId} must be string`);
          }
        }
        key = (0, resolve_1.normalizeId)(key || id);
        this._checkUnique(key);
        this.schemas[key] = this._addSchema(schema, _meta, key, _validateSchema, true);
        return this;
      }
      // Add schema that will be used to validate other schemas
      // options in META_IGNORE_OPTIONS are alway set to false
      addMetaSchema(schema, key, _validateSchema = this.opts.validateSchema) {
        this.addSchema(schema, key, true, _validateSchema);
        return this;
      }
      //  Validate schema against its meta-schema
      validateSchema(schema, throwOrLogError) {
        if (typeof schema == "boolean")
          return true;
        let $schema;
        $schema = schema.$schema;
        if ($schema !== void 0 && typeof $schema != "string") {
          throw new Error("$schema must be a string");
        }
        $schema = $schema || this.opts.defaultMeta || this.defaultMeta();
        if (!$schema) {
          this.logger.warn("meta-schema not available");
          this.errors = null;
          return true;
        }
        const valid = this.validate($schema, schema);
        if (!valid && throwOrLogError) {
          const message = "schema is invalid: " + this.errorsText();
          if (this.opts.validateSchema === "log")
            this.logger.error(message);
          else
            throw new Error(message);
        }
        return valid;
      }
      // Get compiled schema by `key` or `ref`.
      // (`key` that was passed to `addSchema` or full schema reference - `schema.$id` or resolved id)
      getSchema(keyRef) {
        let sch;
        while (typeof (sch = getSchEnv.call(this, keyRef)) == "string")
          keyRef = sch;
        if (sch === void 0) {
          const { schemaId } = this.opts;
          const root = new compile_1.SchemaEnv({ schema: {}, schemaId });
          sch = compile_1.resolveSchema.call(this, root, keyRef);
          if (!sch)
            return;
          this.refs[keyRef] = sch;
        }
        return sch.validate || this._compileSchemaEnv(sch);
      }
      // Remove cached schema(s).
      // If no parameter is passed all schemas but meta-schemas are removed.
      // If RegExp is passed all schemas with key/id matching pattern but meta-schemas are removed.
      // Even if schema is referenced by other schemas it still can be removed as other schemas have local references.
      removeSchema(schemaKeyRef) {
        if (schemaKeyRef instanceof RegExp) {
          this._removeAllSchemas(this.schemas, schemaKeyRef);
          this._removeAllSchemas(this.refs, schemaKeyRef);
          return this;
        }
        switch (typeof schemaKeyRef) {
          case "undefined":
            this._removeAllSchemas(this.schemas);
            this._removeAllSchemas(this.refs);
            this._cache.clear();
            return this;
          case "string": {
            const sch = getSchEnv.call(this, schemaKeyRef);
            if (typeof sch == "object")
              this._cache.delete(sch.schema);
            delete this.schemas[schemaKeyRef];
            delete this.refs[schemaKeyRef];
            return this;
          }
          case "object": {
            const cacheKey = schemaKeyRef;
            this._cache.delete(cacheKey);
            let id = schemaKeyRef[this.opts.schemaId];
            if (id) {
              id = (0, resolve_1.normalizeId)(id);
              delete this.schemas[id];
              delete this.refs[id];
            }
            return this;
          }
          default:
            throw new Error("ajv.removeSchema: invalid parameter");
        }
      }
      // add "vocabulary" - a collection of keywords
      addVocabulary(definitions) {
        for (const def of definitions)
          this.addKeyword(def);
        return this;
      }
      addKeyword(kwdOrDef, def) {
        let keyword;
        if (typeof kwdOrDef == "string") {
          keyword = kwdOrDef;
          if (typeof def == "object") {
            this.logger.warn("these parameters are deprecated, see docs for addKeyword");
            def.keyword = keyword;
          }
        } else if (typeof kwdOrDef == "object" && def === void 0) {
          def = kwdOrDef;
          keyword = def.keyword;
          if (Array.isArray(keyword) && !keyword.length) {
            throw new Error("addKeywords: keyword must be string or non-empty array");
          }
        } else {
          throw new Error("invalid addKeywords parameters");
        }
        checkKeyword.call(this, keyword, def);
        if (!def) {
          (0, util_1.eachItem)(keyword, (kwd) => addRule.call(this, kwd));
          return this;
        }
        keywordMetaschema.call(this, def);
        const definition = {
          ...def,
          type: (0, dataType_1.getJSONTypes)(def.type),
          schemaType: (0, dataType_1.getJSONTypes)(def.schemaType)
        };
        (0, util_1.eachItem)(keyword, definition.type.length === 0 ? (k2) => addRule.call(this, k2, definition) : (k2) => definition.type.forEach((t2) => addRule.call(this, k2, definition, t2)));
        return this;
      }
      getKeyword(keyword) {
        const rule = this.RULES.all[keyword];
        return typeof rule == "object" ? rule.definition : !!rule;
      }
      // Remove keyword
      removeKeyword(keyword) {
        const { RULES } = this;
        delete RULES.keywords[keyword];
        delete RULES.all[keyword];
        for (const group of RULES.rules) {
          const i = group.rules.findIndex((rule) => rule.keyword === keyword);
          if (i >= 0)
            group.rules.splice(i, 1);
        }
        return this;
      }
      // Add format
      addFormat(name, format) {
        if (typeof format == "string")
          format = new RegExp(format);
        this.formats[name] = format;
        return this;
      }
      errorsText(errors = this.errors, { separator = ", ", dataVar = "data" } = {}) {
        if (!errors || errors.length === 0)
          return "No errors";
        return errors.map((e) => `${dataVar}${e.instancePath} ${e.message}`).reduce((text, msg) => text + separator + msg);
      }
      $dataMetaSchema(metaSchema, keywordsJsonPointers) {
        const rules = this.RULES.all;
        metaSchema = JSON.parse(JSON.stringify(metaSchema));
        for (const jsonPointer of keywordsJsonPointers) {
          const segments = jsonPointer.split("/").slice(1);
          let keywords = metaSchema;
          for (const seg of segments)
            keywords = keywords[seg];
          for (const key in rules) {
            const rule = rules[key];
            if (typeof rule != "object")
              continue;
            const { $data } = rule.definition;
            const schema = keywords[key];
            if ($data && schema)
              keywords[key] = schemaOrData(schema);
          }
        }
        return metaSchema;
      }
      _removeAllSchemas(schemas, regex) {
        for (const keyRef in schemas) {
          const sch = schemas[keyRef];
          if (!regex || regex.test(keyRef)) {
            if (typeof sch == "string") {
              delete schemas[keyRef];
            } else if (sch && !sch.meta) {
              this._cache.delete(sch.schema);
              delete schemas[keyRef];
            }
          }
        }
      }
      _addSchema(schema, meta, baseId, validateSchema2 = this.opts.validateSchema, addSchema = this.opts.addUsedSchema) {
        let id;
        const { schemaId } = this.opts;
        if (typeof schema == "object") {
          id = schema[schemaId];
        } else {
          if (this.opts.jtd)
            throw new Error("schema must be object");
          else if (typeof schema != "boolean")
            throw new Error("schema must be object or boolean");
        }
        let sch = this._cache.get(schema);
        if (sch !== void 0)
          return sch;
        baseId = (0, resolve_1.normalizeId)(id || baseId);
        const localRefs = resolve_1.getSchemaRefs.call(this, schema, baseId);
        sch = new compile_1.SchemaEnv({ schema, schemaId, meta, baseId, localRefs });
        this._cache.set(sch.schema, sch);
        if (addSchema && !baseId.startsWith("#")) {
          if (baseId)
            this._checkUnique(baseId);
          this.refs[baseId] = sch;
        }
        if (validateSchema2)
          this.validateSchema(schema, true);
        return sch;
      }
      _checkUnique(id) {
        if (this.schemas[id] || this.refs[id]) {
          throw new Error(`schema with key or id "${id}" already exists`);
        }
      }
      _compileSchemaEnv(sch) {
        if (sch.meta)
          this._compileMetaSchema(sch);
        else
          compile_1.compileSchema.call(this, sch);
        if (!sch.validate)
          throw new Error("ajv implementation error");
        return sch.validate;
      }
      _compileMetaSchema(sch) {
        const currentOpts = this.opts;
        this.opts = this._metaOpts;
        try {
          compile_1.compileSchema.call(this, sch);
        } finally {
          this.opts = currentOpts;
        }
      }
    };
    Ajv.ValidationError = validation_error_1.default;
    Ajv.MissingRefError = ref_error_1.default;
    exports.default = Ajv;
    function checkOptions(checkOpts, options, msg, log = "error") {
      for (const key in checkOpts) {
        const opt = key;
        if (opt in options)
          this.logger[log](`${msg}: option ${key}. ${checkOpts[opt]}`);
      }
    }
    function getSchEnv(keyRef) {
      keyRef = (0, resolve_1.normalizeId)(keyRef);
      return this.schemas[keyRef] || this.refs[keyRef];
    }
    function addInitialSchemas() {
      const optsSchemas = this.opts.schemas;
      if (!optsSchemas)
        return;
      if (Array.isArray(optsSchemas))
        this.addSchema(optsSchemas);
      else
        for (const key in optsSchemas)
          this.addSchema(optsSchemas[key], key);
    }
    function addInitialFormats() {
      for (const name in this.opts.formats) {
        const format = this.opts.formats[name];
        if (format)
          this.addFormat(name, format);
      }
    }
    function addInitialKeywords(defs) {
      if (Array.isArray(defs)) {
        this.addVocabulary(defs);
        return;
      }
      this.logger.warn("keywords option as map is deprecated, pass array");
      for (const keyword in defs) {
        const def = defs[keyword];
        if (!def.keyword)
          def.keyword = keyword;
        this.addKeyword(def);
      }
    }
    function getMetaSchemaOptions() {
      const metaOpts = { ...this.opts };
      for (const opt of META_IGNORE_OPTIONS)
        delete metaOpts[opt];
      return metaOpts;
    }
    var noLogs = { log() {
    }, warn() {
    }, error() {
    } };
    function getLogger(logger) {
      if (logger === false)
        return noLogs;
      if (logger === void 0)
        return console;
      if (logger.log && logger.warn && logger.error)
        return logger;
      throw new Error("logger must implement log, warn and error methods");
    }
    var KEYWORD_NAME = /^[a-z_$][a-z0-9_$:-]*$/i;
    function checkKeyword(keyword, def) {
      const { RULES } = this;
      (0, util_1.eachItem)(keyword, (kwd) => {
        if (RULES.keywords[kwd])
          throw new Error(`Keyword ${kwd} is already defined`);
        if (!KEYWORD_NAME.test(kwd))
          throw new Error(`Keyword ${kwd} has invalid name`);
      });
      if (!def)
        return;
      if (def.$data && !("code" in def || "validate" in def)) {
        throw new Error('$data keyword must have "code" or "validate" function');
      }
    }
    function addRule(keyword, definition, dataType) {
      var _a;
      const post = definition === null || definition === void 0 ? void 0 : definition.post;
      if (dataType && post)
        throw new Error('keyword with "post" flag cannot have "type"');
      const { RULES } = this;
      let ruleGroup = post ? RULES.post : RULES.rules.find(({ type: t2 }) => t2 === dataType);
      if (!ruleGroup) {
        ruleGroup = { type: dataType, rules: [] };
        RULES.rules.push(ruleGroup);
      }
      RULES.keywords[keyword] = true;
      if (!definition)
        return;
      const rule = {
        keyword,
        definition: {
          ...definition,
          type: (0, dataType_1.getJSONTypes)(definition.type),
          schemaType: (0, dataType_1.getJSONTypes)(definition.schemaType)
        }
      };
      if (definition.before)
        addBeforeRule.call(this, ruleGroup, rule, definition.before);
      else
        ruleGroup.rules.push(rule);
      RULES.all[keyword] = rule;
      (_a = definition.implements) === null || _a === void 0 ? void 0 : _a.forEach((kwd) => this.addKeyword(kwd));
    }
    function addBeforeRule(ruleGroup, rule, before) {
      const i = ruleGroup.rules.findIndex((_rule) => _rule.keyword === before);
      if (i >= 0) {
        ruleGroup.rules.splice(i, 0, rule);
      } else {
        ruleGroup.rules.push(rule);
        this.logger.warn(`rule ${before} is not defined`);
      }
    }
    function keywordMetaschema(def) {
      let { metaSchema } = def;
      if (metaSchema === void 0)
        return;
      if (def.$data && this.opts.$data)
        metaSchema = schemaOrData(metaSchema);
      def.validateSchema = this.compile(metaSchema, true);
    }
    var $dataRef = {
      $ref: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#"
    };
    function schemaOrData(schema) {
      return { anyOf: [schema, $dataRef] };
    }
  }
});

// node_modules/ajv/dist/vocabularies/core/id.js
var require_id = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/id.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var def = {
      keyword: "id",
      code() {
        throw new Error('NOT SUPPORTED: keyword "id", use "$id" for schema ID');
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/core/ref.js
var require_ref = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/ref.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.callRef = exports.getValidate = void 0;
    var ref_error_1 = require_ref_error();
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var compile_1 = require_compile();
    var util_1 = require_util();
    var def = {
      keyword: "$ref",
      schemaType: "string",
      code(cxt) {
        const { gen, schema: $ref, it: it2 } = cxt;
        const { baseId, schemaEnv: env, validateName, opts, self } = it2;
        const { root } = env;
        if (($ref === "#" || $ref === "#/") && baseId === root.baseId)
          return callRootRef();
        const schOrEnv = compile_1.resolveRef.call(self, root, baseId, $ref);
        if (schOrEnv === void 0)
          throw new ref_error_1.default(it2.opts.uriResolver, baseId, $ref);
        if (schOrEnv instanceof compile_1.SchemaEnv)
          return callValidate(schOrEnv);
        return inlineRefSchema(schOrEnv);
        function callRootRef() {
          if (env === root)
            return callRef(cxt, validateName, env, env.$async);
          const rootName = gen.scopeValue("root", { ref: root });
          return callRef(cxt, (0, codegen_1._)`${rootName}.validate`, root, root.$async);
        }
        function callValidate(sch) {
          const v = getValidate(cxt, sch);
          callRef(cxt, v, sch, sch.$async);
        }
        function inlineRefSchema(sch) {
          const schName = gen.scopeValue("schema", opts.code.source === true ? { ref: sch, code: (0, codegen_1.stringify)(sch) } : { ref: sch });
          const valid = gen.name("valid");
          const schCxt = cxt.subschema({
            schema: sch,
            dataTypes: [],
            schemaPath: codegen_1.nil,
            topSchemaRef: schName,
            errSchemaPath: $ref
          }, valid);
          cxt.mergeEvaluated(schCxt);
          cxt.ok(valid);
        }
      }
    };
    function getValidate(cxt, sch) {
      const { gen } = cxt;
      return sch.validate ? gen.scopeValue("validate", { ref: sch.validate }) : (0, codegen_1._)`${gen.scopeValue("wrapper", { ref: sch })}.validate`;
    }
    exports.getValidate = getValidate;
    function callRef(cxt, v, sch, $async) {
      const { gen, it: it2 } = cxt;
      const { allErrors, schemaEnv: env, opts } = it2;
      const passCxt = opts.passContext ? names_1.default.this : codegen_1.nil;
      if ($async)
        callAsyncRef();
      else
        callSyncRef();
      function callAsyncRef() {
        if (!env.$async)
          throw new Error("async schema referenced by sync schema");
        const valid = gen.let("valid");
        gen.try(() => {
          gen.code((0, codegen_1._)`await ${(0, code_1.callValidateCode)(cxt, v, passCxt)}`);
          addEvaluatedFrom(v);
          if (!allErrors)
            gen.assign(valid, true);
        }, (e) => {
          gen.if((0, codegen_1._)`!(${e} instanceof ${it2.ValidationError})`, () => gen.throw(e));
          addErrorsFrom(e);
          if (!allErrors)
            gen.assign(valid, false);
        });
        cxt.ok(valid);
      }
      function callSyncRef() {
        cxt.result((0, code_1.callValidateCode)(cxt, v, passCxt), () => addEvaluatedFrom(v), () => addErrorsFrom(v));
      }
      function addErrorsFrom(source) {
        const errs = (0, codegen_1._)`${source}.errors`;
        gen.assign(names_1.default.vErrors, (0, codegen_1._)`${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`);
        gen.assign(names_1.default.errors, (0, codegen_1._)`${names_1.default.vErrors}.length`);
      }
      function addEvaluatedFrom(source) {
        var _a;
        if (!it2.opts.unevaluated)
          return;
        const schEvaluated = (_a = sch === null || sch === void 0 ? void 0 : sch.validate) === null || _a === void 0 ? void 0 : _a.evaluated;
        if (it2.props !== true) {
          if (schEvaluated && !schEvaluated.dynamicProps) {
            if (schEvaluated.props !== void 0) {
              it2.props = util_1.mergeEvaluated.props(gen, schEvaluated.props, it2.props);
            }
          } else {
            const props = gen.var("props", (0, codegen_1._)`${source}.evaluated.props`);
            it2.props = util_1.mergeEvaluated.props(gen, props, it2.props, codegen_1.Name);
          }
        }
        if (it2.items !== true) {
          if (schEvaluated && !schEvaluated.dynamicItems) {
            if (schEvaluated.items !== void 0) {
              it2.items = util_1.mergeEvaluated.items(gen, schEvaluated.items, it2.items);
            }
          } else {
            const items = gen.var("items", (0, codegen_1._)`${source}.evaluated.items`);
            it2.items = util_1.mergeEvaluated.items(gen, items, it2.items, codegen_1.Name);
          }
        }
      }
    }
    exports.callRef = callRef;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/core/index.js
var require_core2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var id_1 = require_id();
    var ref_1 = require_ref();
    var core = [
      "$schema",
      "$id",
      "$defs",
      "$vocabulary",
      { keyword: "$comment" },
      "definitions",
      id_1.default,
      ref_1.default
    ];
    exports.default = core;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitNumber.js
var require_limitNumber = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitNumber.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var ops = codegen_1.operators;
    var KWDs = {
      maximum: { okStr: "<=", ok: ops.LTE, fail: ops.GT },
      minimum: { okStr: ">=", ok: ops.GTE, fail: ops.LT },
      exclusiveMaximum: { okStr: "<", ok: ops.LT, fail: ops.GTE },
      exclusiveMinimum: { okStr: ">", ok: ops.GT, fail: ops.LTE }
    };
    var error = {
      message: ({ keyword, schemaCode }) => (0, codegen_1.str)`must be ${KWDs[keyword].okStr} ${schemaCode}`,
      params: ({ keyword, schemaCode }) => (0, codegen_1._)`{comparison: ${KWDs[keyword].okStr}, limit: ${schemaCode}}`
    };
    var def = {
      keyword: Object.keys(KWDs),
      type: "number",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        cxt.fail$data((0, codegen_1._)`${data} ${KWDs[keyword].fail} ${schemaCode} || isNaN(${data})`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/multipleOf.js
var require_multipleOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/multipleOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must be multiple of ${schemaCode}`,
      params: ({ schemaCode }) => (0, codegen_1._)`{multipleOf: ${schemaCode}}`
    };
    var def = {
      keyword: "multipleOf",
      type: "number",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, schemaCode, it: it2 } = cxt;
        const prec = it2.opts.multipleOfPrecision;
        const res = gen.let("res");
        const invalid3 = prec ? (0, codegen_1._)`Math.abs(Math.round(${res}) - ${res}) > 1e-${prec}` : (0, codegen_1._)`${res} !== parseInt(${res})`;
        cxt.fail$data((0, codegen_1._)`(${schemaCode} === 0 || (${res} = ${data}/${schemaCode}, ${invalid3}))`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/runtime/ucs2length.js
var require_ucs2length = __commonJS({
  "node_modules/ajv/dist/runtime/ucs2length.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function ucs2length(str) {
      const len = str.length;
      let length = 0;
      let pos = 0;
      let value;
      while (pos < len) {
        length++;
        value = str.charCodeAt(pos++);
        if (value >= 55296 && value <= 56319 && pos < len) {
          value = str.charCodeAt(pos);
          if ((value & 64512) === 56320)
            pos++;
        }
      }
      return length;
    }
    exports.default = ucs2length;
    ucs2length.code = 'require("ajv/dist/runtime/ucs2length").default';
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitLength.js
var require_limitLength = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitLength.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var ucs2length_1 = require_ucs2length();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxLength" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} characters`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxLength", "minLength"],
      type: "string",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode, it: it2 } = cxt;
        const op = keyword === "maxLength" ? codegen_1.operators.GT : codegen_1.operators.LT;
        const len = it2.opts.unicode === false ? (0, codegen_1._)`${data}.length` : (0, codegen_1._)`${(0, util_1.useFunc)(cxt.gen, ucs2length_1.default)}(${data})`;
        cxt.fail$data((0, codegen_1._)`${len} ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/pattern.js
var require_pattern = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/pattern.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var util_1 = require_util();
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must match pattern "${schemaCode}"`,
      params: ({ schemaCode }) => (0, codegen_1._)`{pattern: ${schemaCode}}`
    };
    var def = {
      keyword: "pattern",
      type: "string",
      schemaType: "string",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema, schemaCode, it: it2 } = cxt;
        const u = it2.opts.unicodeRegExp ? "u" : "";
        if ($data) {
          const { regExp } = it2.opts.code;
          const regExpCode = regExp.code === "new RegExp" ? (0, codegen_1._)`new RegExp` : (0, util_1.useFunc)(gen, regExp);
          const valid = gen.let("valid");
          gen.try(() => gen.assign(valid, (0, codegen_1._)`${regExpCode}(${schemaCode}, ${u}).test(${data})`), () => gen.assign(valid, false));
          cxt.fail$data((0, codegen_1._)`!${valid}`);
        } else {
          const regExp = (0, code_1.usePattern)(cxt, schema);
          cxt.fail$data((0, codegen_1._)`!${regExp}.test(${data})`);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitProperties.js
var require_limitProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxProperties" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} properties`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxProperties", "minProperties"],
      type: "object",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        const op = keyword === "maxProperties" ? codegen_1.operators.GT : codegen_1.operators.LT;
        cxt.fail$data((0, codegen_1._)`Object.keys(${data}).length ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/required.js
var require_required = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/required.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { missingProperty } }) => (0, codegen_1.str)`must have required property '${missingProperty}'`,
      params: ({ params: { missingProperty } }) => (0, codegen_1._)`{missingProperty: ${missingProperty}}`
    };
    var def = {
      keyword: "required",
      type: "object",
      schemaType: "array",
      $data: true,
      error,
      code(cxt) {
        const { gen, schema, schemaCode, data, $data, it: it2 } = cxt;
        const { opts } = it2;
        if (!$data && schema.length === 0)
          return;
        const useLoop = schema.length >= opts.loopRequired;
        if (it2.allErrors)
          allErrorsMode();
        else
          exitOnErrorMode();
        if (opts.strictRequired) {
          const props = cxt.parentSchema.properties;
          const { definedProperties } = cxt.it;
          for (const requiredKey of schema) {
            if ((props === null || props === void 0 ? void 0 : props[requiredKey]) === void 0 && !definedProperties.has(requiredKey)) {
              const schemaPath = it2.schemaEnv.baseId + it2.errSchemaPath;
              const msg = `required property "${requiredKey}" is not defined at "${schemaPath}" (strictRequired)`;
              (0, util_1.checkStrictMode)(it2, msg, it2.opts.strictRequired);
            }
          }
        }
        function allErrorsMode() {
          if (useLoop || $data) {
            cxt.block$data(codegen_1.nil, loopAllRequired);
          } else {
            for (const prop of schema) {
              (0, code_1.checkReportMissingProp)(cxt, prop);
            }
          }
        }
        function exitOnErrorMode() {
          const missing = gen.let("missing");
          if (useLoop || $data) {
            const valid = gen.let("valid", true);
            cxt.block$data(valid, () => loopUntilMissing(missing, valid));
            cxt.ok(valid);
          } else {
            gen.if((0, code_1.checkMissingProp)(cxt, schema, missing));
            (0, code_1.reportMissingProp)(cxt, missing);
            gen.else();
          }
        }
        function loopAllRequired() {
          gen.forOf("prop", schemaCode, (prop) => {
            cxt.setParams({ missingProperty: prop });
            gen.if((0, code_1.noPropertyInData)(gen, data, prop, opts.ownProperties), () => cxt.error());
          });
        }
        function loopUntilMissing(missing, valid) {
          cxt.setParams({ missingProperty: missing });
          gen.forOf(missing, schemaCode, () => {
            gen.assign(valid, (0, code_1.propertyInData)(gen, data, missing, opts.ownProperties));
            gen.if((0, codegen_1.not)(valid), () => {
              cxt.error();
              gen.break();
            });
          }, codegen_1.nil);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitItems.js
var require_limitItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxItems" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} items`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxItems", "minItems"],
      type: "array",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        const op = keyword === "maxItems" ? codegen_1.operators.GT : codegen_1.operators.LT;
        cxt.fail$data((0, codegen_1._)`${data}.length ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/runtime/equal.js
var require_equal = __commonJS({
  "node_modules/ajv/dist/runtime/equal.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var equal = require_fast_deep_equal();
    equal.code = 'require("ajv/dist/runtime/equal").default';
    exports.default = equal;
  }
});

// node_modules/ajv/dist/vocabularies/validation/uniqueItems.js
var require_uniqueItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/uniqueItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dataType_1 = require_dataType();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: ({ params: { i, j: j2 } }) => (0, codegen_1.str)`must NOT have duplicate items (items ## ${j2} and ${i} are identical)`,
      params: ({ params: { i, j: j2 } }) => (0, codegen_1._)`{i: ${i}, j: ${j2}}`
    };
    var def = {
      keyword: "uniqueItems",
      type: "array",
      schemaType: "boolean",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema, parentSchema, schemaCode, it: it2 } = cxt;
        if (!$data && !schema)
          return;
        const valid = gen.let("valid");
        const itemTypes = parentSchema.items ? (0, dataType_1.getSchemaTypes)(parentSchema.items) : [];
        cxt.block$data(valid, validateUniqueItems, (0, codegen_1._)`${schemaCode} === false`);
        cxt.ok(valid);
        function validateUniqueItems() {
          const i = gen.let("i", (0, codegen_1._)`${data}.length`);
          const j2 = gen.let("j");
          cxt.setParams({ i, j: j2 });
          gen.assign(valid, true);
          gen.if((0, codegen_1._)`${i} > 1`, () => (canOptimize() ? loopN : loopN2)(i, j2));
        }
        function canOptimize() {
          return itemTypes.length > 0 && !itemTypes.some((t2) => t2 === "object" || t2 === "array");
        }
        function loopN(i, j2) {
          const item = gen.name("item");
          const wrongType = (0, dataType_1.checkDataTypes)(itemTypes, item, it2.opts.strictNumbers, dataType_1.DataType.Wrong);
          const indices = gen.const("indices", (0, codegen_1._)`{}`);
          gen.for((0, codegen_1._)`;${i}--;`, () => {
            gen.let(item, (0, codegen_1._)`${data}[${i}]`);
            gen.if(wrongType, (0, codegen_1._)`continue`);
            if (itemTypes.length > 1)
              gen.if((0, codegen_1._)`typeof ${item} == "string"`, (0, codegen_1._)`${item} += "_"`);
            gen.if((0, codegen_1._)`typeof ${indices}[${item}] == "number"`, () => {
              gen.assign(j2, (0, codegen_1._)`${indices}[${item}]`);
              cxt.error();
              gen.assign(valid, false).break();
            }).code((0, codegen_1._)`${indices}[${item}] = ${i}`);
          });
        }
        function loopN2(i, j2) {
          const eql = (0, util_1.useFunc)(gen, equal_1.default);
          const outer = gen.name("outer");
          gen.label(outer).for((0, codegen_1._)`;${i}--;`, () => gen.for((0, codegen_1._)`${j2} = ${i}; ${j2}--;`, () => gen.if((0, codegen_1._)`${eql}(${data}[${i}], ${data}[${j2}])`, () => {
            cxt.error();
            gen.assign(valid, false).break(outer);
          })));
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/const.js
var require_const = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/const.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: "must be equal to constant",
      params: ({ schemaCode }) => (0, codegen_1._)`{allowedValue: ${schemaCode}}`
    };
    var def = {
      keyword: "const",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schemaCode, schema } = cxt;
        if ($data || schema && typeof schema == "object") {
          cxt.fail$data((0, codegen_1._)`!${(0, util_1.useFunc)(gen, equal_1.default)}(${data}, ${schemaCode})`);
        } else {
          cxt.fail((0, codegen_1._)`${schema} !== ${data}`);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/enum.js
var require_enum = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/enum.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: "must be equal to one of the allowed values",
      params: ({ schemaCode }) => (0, codegen_1._)`{allowedValues: ${schemaCode}}`
    };
    var def = {
      keyword: "enum",
      schemaType: "array",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema, schemaCode, it: it2 } = cxt;
        if (!$data && schema.length === 0)
          throw new Error("enum must have non-empty array");
        const useLoop = schema.length >= it2.opts.loopEnum;
        let eql;
        const getEql = () => eql !== null && eql !== void 0 ? eql : eql = (0, util_1.useFunc)(gen, equal_1.default);
        let valid;
        if (useLoop || $data) {
          valid = gen.let("valid");
          cxt.block$data(valid, loopEnum);
        } else {
          if (!Array.isArray(schema))
            throw new Error("ajv implementation error");
          const vSchema = gen.const("vSchema", schemaCode);
          valid = (0, codegen_1.or)(...schema.map((_x, i) => equalCode(vSchema, i)));
        }
        cxt.pass(valid);
        function loopEnum() {
          gen.assign(valid, false);
          gen.forOf("v", schemaCode, (v) => gen.if((0, codegen_1._)`${getEql()}(${data}, ${v})`, () => gen.assign(valid, true).break()));
        }
        function equalCode(vSchema, i) {
          const sch = schema[i];
          return typeof sch === "object" && sch !== null ? (0, codegen_1._)`${getEql()}(${data}, ${vSchema}[${i}])` : (0, codegen_1._)`${data} === ${sch}`;
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/index.js
var require_validation = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var limitNumber_1 = require_limitNumber();
    var multipleOf_1 = require_multipleOf();
    var limitLength_1 = require_limitLength();
    var pattern_1 = require_pattern();
    var limitProperties_1 = require_limitProperties();
    var required_1 = require_required();
    var limitItems_1 = require_limitItems();
    var uniqueItems_1 = require_uniqueItems();
    var const_1 = require_const();
    var enum_1 = require_enum();
    var validation = [
      // number
      limitNumber_1.default,
      multipleOf_1.default,
      // string
      limitLength_1.default,
      pattern_1.default,
      // object
      limitProperties_1.default,
      required_1.default,
      // array
      limitItems_1.default,
      uniqueItems_1.default,
      // any
      { keyword: "type", schemaType: ["string", "array"] },
      { keyword: "nullable", schemaType: "boolean" },
      const_1.default,
      enum_1.default
    ];
    exports.default = validation;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/additionalItems.js
var require_additionalItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/additionalItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateAdditionalItems = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    };
    var def = {
      keyword: "additionalItems",
      type: "array",
      schemaType: ["boolean", "object"],
      before: "uniqueItems",
      error,
      code(cxt) {
        const { parentSchema, it: it2 } = cxt;
        const { items } = parentSchema;
        if (!Array.isArray(items)) {
          (0, util_1.checkStrictMode)(it2, '"additionalItems" is ignored when "items" is not an array of schemas');
          return;
        }
        validateAdditionalItems(cxt, items);
      }
    };
    function validateAdditionalItems(cxt, items) {
      const { gen, schema, data, keyword, it: it2 } = cxt;
      it2.items = true;
      const len = gen.const("len", (0, codegen_1._)`${data}.length`);
      if (schema === false) {
        cxt.setParams({ len: items.length });
        cxt.pass((0, codegen_1._)`${len} <= ${items.length}`);
      } else if (typeof schema == "object" && !(0, util_1.alwaysValidSchema)(it2, schema)) {
        const valid = gen.var("valid", (0, codegen_1._)`${len} <= ${items.length}`);
        gen.if((0, codegen_1.not)(valid), () => validateItems(valid));
        cxt.ok(valid);
      }
      function validateItems(valid) {
        gen.forRange("i", items.length, len, (i) => {
          cxt.subschema({ keyword, dataProp: i, dataPropType: util_1.Type.Num }, valid);
          if (!it2.allErrors)
            gen.if((0, codegen_1.not)(valid), () => gen.break());
        });
      }
    }
    exports.validateAdditionalItems = validateAdditionalItems;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/items.js
var require_items = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/items.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateTuple = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    var def = {
      keyword: "items",
      type: "array",
      schemaType: ["object", "array", "boolean"],
      before: "uniqueItems",
      code(cxt) {
        const { schema, it: it2 } = cxt;
        if (Array.isArray(schema))
          return validateTuple(cxt, "additionalItems", schema);
        it2.items = true;
        if ((0, util_1.alwaysValidSchema)(it2, schema))
          return;
        cxt.ok((0, code_1.validateArray)(cxt));
      }
    };
    function validateTuple(cxt, extraItems, schArr = cxt.schema) {
      const { gen, parentSchema, data, keyword, it: it2 } = cxt;
      checkStrictTuple(parentSchema);
      if (it2.opts.unevaluated && schArr.length && it2.items !== true) {
        it2.items = util_1.mergeEvaluated.items(gen, schArr.length, it2.items);
      }
      const valid = gen.name("valid");
      const len = gen.const("len", (0, codegen_1._)`${data}.length`);
      schArr.forEach((sch, i) => {
        if ((0, util_1.alwaysValidSchema)(it2, sch))
          return;
        gen.if((0, codegen_1._)`${len} > ${i}`, () => cxt.subschema({
          keyword,
          schemaProp: i,
          dataProp: i
        }, valid));
        cxt.ok(valid);
      });
      function checkStrictTuple(sch) {
        const { opts, errSchemaPath } = it2;
        const l = schArr.length;
        const fullTuple = l === sch.minItems && (l === sch.maxItems || sch[extraItems] === false);
        if (opts.strictTuples && !fullTuple) {
          const msg = `"${keyword}" is ${l}-tuple, but minItems or maxItems/${extraItems} are not specified or different at path "${errSchemaPath}"`;
          (0, util_1.checkStrictMode)(it2, msg, opts.strictTuples);
        }
      }
    }
    exports.validateTuple = validateTuple;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/prefixItems.js
var require_prefixItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/prefixItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var items_1 = require_items();
    var def = {
      keyword: "prefixItems",
      type: "array",
      schemaType: ["array"],
      before: "uniqueItems",
      code: (cxt) => (0, items_1.validateTuple)(cxt, "items")
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/items2020.js
var require_items2020 = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/items2020.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    var additionalItems_1 = require_additionalItems();
    var error = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    };
    var def = {
      keyword: "items",
      type: "array",
      schemaType: ["object", "boolean"],
      before: "uniqueItems",
      error,
      code(cxt) {
        const { schema, parentSchema, it: it2 } = cxt;
        const { prefixItems } = parentSchema;
        it2.items = true;
        if ((0, util_1.alwaysValidSchema)(it2, schema))
          return;
        if (prefixItems)
          (0, additionalItems_1.validateAdditionalItems)(cxt, prefixItems);
        else
          cxt.ok((0, code_1.validateArray)(cxt));
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/contains.js
var require_contains = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/contains.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { min, max } }) => max === void 0 ? (0, codegen_1.str)`must contain at least ${min} valid item(s)` : (0, codegen_1.str)`must contain at least ${min} and no more than ${max} valid item(s)`,
      params: ({ params: { min, max } }) => max === void 0 ? (0, codegen_1._)`{minContains: ${min}}` : (0, codegen_1._)`{minContains: ${min}, maxContains: ${max}}`
    };
    var def = {
      keyword: "contains",
      type: "array",
      schemaType: ["object", "boolean"],
      before: "uniqueItems",
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema, parentSchema, data, it: it2 } = cxt;
        let min;
        let max;
        const { minContains, maxContains } = parentSchema;
        if (it2.opts.next) {
          min = minContains === void 0 ? 1 : minContains;
          max = maxContains;
        } else {
          min = 1;
        }
        const len = gen.const("len", (0, codegen_1._)`${data}.length`);
        cxt.setParams({ min, max });
        if (max === void 0 && min === 0) {
          (0, util_1.checkStrictMode)(it2, `"minContains" == 0 without "maxContains": "contains" keyword ignored`);
          return;
        }
        if (max !== void 0 && min > max) {
          (0, util_1.checkStrictMode)(it2, `"minContains" > "maxContains" is always invalid`);
          cxt.fail();
          return;
        }
        if ((0, util_1.alwaysValidSchema)(it2, schema)) {
          let cond = (0, codegen_1._)`${len} >= ${min}`;
          if (max !== void 0)
            cond = (0, codegen_1._)`${cond} && ${len} <= ${max}`;
          cxt.pass(cond);
          return;
        }
        it2.items = true;
        const valid = gen.name("valid");
        if (max === void 0 && min === 1) {
          validateItems(valid, () => gen.if(valid, () => gen.break()));
        } else if (min === 0) {
          gen.let(valid, true);
          if (max !== void 0)
            gen.if((0, codegen_1._)`${data}.length > 0`, validateItemsWithCount);
        } else {
          gen.let(valid, false);
          validateItemsWithCount();
        }
        cxt.result(valid, () => cxt.reset());
        function validateItemsWithCount() {
          const schValid = gen.name("_valid");
          const count = gen.let("count", 0);
          validateItems(schValid, () => gen.if(schValid, () => checkLimits(count)));
        }
        function validateItems(_valid, block) {
          gen.forRange("i", 0, len, (i) => {
            cxt.subschema({
              keyword: "contains",
              dataProp: i,
              dataPropType: util_1.Type.Num,
              compositeRule: true
            }, _valid);
            block();
          });
        }
        function checkLimits(count) {
          gen.code((0, codegen_1._)`${count}++`);
          if (max === void 0) {
            gen.if((0, codegen_1._)`${count} >= ${min}`, () => gen.assign(valid, true).break());
          } else {
            gen.if((0, codegen_1._)`${count} > ${max}`, () => gen.assign(valid, false).break());
            if (min === 1)
              gen.assign(valid, true);
            else
              gen.if((0, codegen_1._)`${count} >= ${min}`, () => gen.assign(valid, true));
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/dependencies.js
var require_dependencies = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/dependencies.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateSchemaDeps = exports.validatePropertyDeps = exports.error = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    exports.error = {
      message: ({ params: { property, depsCount, deps } }) => {
        const property_ies = depsCount === 1 ? "property" : "properties";
        return (0, codegen_1.str)`must have ${property_ies} ${deps} when property ${property} is present`;
      },
      params: ({ params: { property, depsCount, deps, missingProperty } }) => (0, codegen_1._)`{property: ${property},
    missingProperty: ${missingProperty},
    depsCount: ${depsCount},
    deps: ${deps}}`
      // TODO change to reference
    };
    var def = {
      keyword: "dependencies",
      type: "object",
      schemaType: "object",
      error: exports.error,
      code(cxt) {
        const [propDeps, schDeps] = splitDependencies(cxt);
        validatePropertyDeps(cxt, propDeps);
        validateSchemaDeps(cxt, schDeps);
      }
    };
    function splitDependencies({ schema }) {
      const propertyDeps = {};
      const schemaDeps = {};
      for (const key in schema) {
        if (key === "__proto__")
          continue;
        const deps = Array.isArray(schema[key]) ? propertyDeps : schemaDeps;
        deps[key] = schema[key];
      }
      return [propertyDeps, schemaDeps];
    }
    function validatePropertyDeps(cxt, propertyDeps = cxt.schema) {
      const { gen, data, it: it2 } = cxt;
      if (Object.keys(propertyDeps).length === 0)
        return;
      const missing = gen.let("missing");
      for (const prop in propertyDeps) {
        const deps = propertyDeps[prop];
        if (deps.length === 0)
          continue;
        const hasProperty = (0, code_1.propertyInData)(gen, data, prop, it2.opts.ownProperties);
        cxt.setParams({
          property: prop,
          depsCount: deps.length,
          deps: deps.join(", ")
        });
        if (it2.allErrors) {
          gen.if(hasProperty, () => {
            for (const depProp of deps) {
              (0, code_1.checkReportMissingProp)(cxt, depProp);
            }
          });
        } else {
          gen.if((0, codegen_1._)`${hasProperty} && (${(0, code_1.checkMissingProp)(cxt, deps, missing)})`);
          (0, code_1.reportMissingProp)(cxt, missing);
          gen.else();
        }
      }
    }
    exports.validatePropertyDeps = validatePropertyDeps;
    function validateSchemaDeps(cxt, schemaDeps = cxt.schema) {
      const { gen, data, keyword, it: it2 } = cxt;
      const valid = gen.name("valid");
      for (const prop in schemaDeps) {
        if ((0, util_1.alwaysValidSchema)(it2, schemaDeps[prop]))
          continue;
        gen.if(
          (0, code_1.propertyInData)(gen, data, prop, it2.opts.ownProperties),
          () => {
            const schCxt = cxt.subschema({ keyword, schemaProp: prop }, valid);
            cxt.mergeValidEvaluated(schCxt, valid);
          },
          () => gen.var(valid, true)
          // TODO var
        );
        cxt.ok(valid);
      }
    }
    exports.validateSchemaDeps = validateSchemaDeps;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/propertyNames.js
var require_propertyNames = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/propertyNames.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: "property name must be valid",
      params: ({ params }) => (0, codegen_1._)`{propertyName: ${params.propertyName}}`
    };
    var def = {
      keyword: "propertyNames",
      type: "object",
      schemaType: ["object", "boolean"],
      error,
      code(cxt) {
        const { gen, schema, data, it: it2 } = cxt;
        if ((0, util_1.alwaysValidSchema)(it2, schema))
          return;
        const valid = gen.name("valid");
        gen.forIn("key", data, (key) => {
          cxt.setParams({ propertyName: key });
          cxt.subschema({
            keyword: "propertyNames",
            data: key,
            dataTypes: ["string"],
            propertyName: key,
            compositeRule: true
          }, valid);
          gen.if((0, codegen_1.not)(valid), () => {
            cxt.error(true);
            if (!it2.allErrors)
              gen.break();
          });
        });
        cxt.ok(valid);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/additionalProperties.js
var require_additionalProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/additionalProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var util_1 = require_util();
    var error = {
      message: "must NOT have additional properties",
      params: ({ params }) => (0, codegen_1._)`{additionalProperty: ${params.additionalProperty}}`
    };
    var def = {
      keyword: "additionalProperties",
      type: ["object"],
      schemaType: ["boolean", "object"],
      allowUndefined: true,
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema, parentSchema, data, errsCount, it: it2 } = cxt;
        if (!errsCount)
          throw new Error("ajv implementation error");
        const { allErrors, opts } = it2;
        it2.props = true;
        if (opts.removeAdditional !== "all" && (0, util_1.alwaysValidSchema)(it2, schema))
          return;
        const props = (0, code_1.allSchemaProperties)(parentSchema.properties);
        const patProps = (0, code_1.allSchemaProperties)(parentSchema.patternProperties);
        checkAdditionalProperties();
        cxt.ok((0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
        function checkAdditionalProperties() {
          gen.forIn("key", data, (key) => {
            if (!props.length && !patProps.length)
              additionalPropertyCode(key);
            else
              gen.if(isAdditional(key), () => additionalPropertyCode(key));
          });
        }
        function isAdditional(key) {
          let definedProp;
          if (props.length > 8) {
            const propsSchema = (0, util_1.schemaRefOrVal)(it2, parentSchema.properties, "properties");
            definedProp = (0, code_1.isOwnProperty)(gen, propsSchema, key);
          } else if (props.length) {
            definedProp = (0, codegen_1.or)(...props.map((p) => (0, codegen_1._)`${key} === ${p}`));
          } else {
            definedProp = codegen_1.nil;
          }
          if (patProps.length) {
            definedProp = (0, codegen_1.or)(definedProp, ...patProps.map((p) => (0, codegen_1._)`${(0, code_1.usePattern)(cxt, p)}.test(${key})`));
          }
          return (0, codegen_1.not)(definedProp);
        }
        function deleteAdditional(key) {
          gen.code((0, codegen_1._)`delete ${data}[${key}]`);
        }
        function additionalPropertyCode(key) {
          if (opts.removeAdditional === "all" || opts.removeAdditional && schema === false) {
            deleteAdditional(key);
            return;
          }
          if (schema === false) {
            cxt.setParams({ additionalProperty: key });
            cxt.error();
            if (!allErrors)
              gen.break();
            return;
          }
          if (typeof schema == "object" && !(0, util_1.alwaysValidSchema)(it2, schema)) {
            const valid = gen.name("valid");
            if (opts.removeAdditional === "failing") {
              applyAdditionalSchema(key, valid, false);
              gen.if((0, codegen_1.not)(valid), () => {
                cxt.reset();
                deleteAdditional(key);
              });
            } else {
              applyAdditionalSchema(key, valid);
              if (!allErrors)
                gen.if((0, codegen_1.not)(valid), () => gen.break());
            }
          }
        }
        function applyAdditionalSchema(key, valid, errors) {
          const subschema = {
            keyword: "additionalProperties",
            dataProp: key,
            dataPropType: util_1.Type.Str
          };
          if (errors === false) {
            Object.assign(subschema, {
              compositeRule: true,
              createErrors: false,
              allErrors: false
            });
          }
          cxt.subschema(subschema, valid);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/properties.js
var require_properties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/properties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var validate_1 = require_validate();
    var code_1 = require_code2();
    var util_1 = require_util();
    var additionalProperties_1 = require_additionalProperties();
    var def = {
      keyword: "properties",
      type: "object",
      schemaType: "object",
      code(cxt) {
        const { gen, schema, parentSchema, data, it: it2 } = cxt;
        if (it2.opts.removeAdditional === "all" && parentSchema.additionalProperties === void 0) {
          additionalProperties_1.default.code(new validate_1.KeywordCxt(it2, additionalProperties_1.default, "additionalProperties"));
        }
        const allProps = (0, code_1.allSchemaProperties)(schema);
        for (const prop of allProps) {
          it2.definedProperties.add(prop);
        }
        if (it2.opts.unevaluated && allProps.length && it2.props !== true) {
          it2.props = util_1.mergeEvaluated.props(gen, (0, util_1.toHash)(allProps), it2.props);
        }
        const properties = allProps.filter((p) => !(0, util_1.alwaysValidSchema)(it2, schema[p]));
        if (properties.length === 0)
          return;
        const valid = gen.name("valid");
        for (const prop of properties) {
          if (hasDefault(prop)) {
            applyPropertySchema(prop);
          } else {
            gen.if((0, code_1.propertyInData)(gen, data, prop, it2.opts.ownProperties));
            applyPropertySchema(prop);
            if (!it2.allErrors)
              gen.else().var(valid, true);
            gen.endIf();
          }
          cxt.it.definedProperties.add(prop);
          cxt.ok(valid);
        }
        function hasDefault(prop) {
          return it2.opts.useDefaults && !it2.compositeRule && schema[prop].default !== void 0;
        }
        function applyPropertySchema(prop) {
          cxt.subschema({
            keyword: "properties",
            schemaProp: prop,
            dataProp: prop
          }, valid);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/patternProperties.js
var require_patternProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/patternProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var util_2 = require_util();
    var def = {
      keyword: "patternProperties",
      type: "object",
      schemaType: "object",
      code(cxt) {
        const { gen, schema, data, parentSchema, it: it2 } = cxt;
        const { opts } = it2;
        const patterns = (0, code_1.allSchemaProperties)(schema);
        const alwaysValidPatterns = patterns.filter((p) => (0, util_1.alwaysValidSchema)(it2, schema[p]));
        if (patterns.length === 0 || alwaysValidPatterns.length === patterns.length && (!it2.opts.unevaluated || it2.props === true)) {
          return;
        }
        const checkProperties = opts.strictSchema && !opts.allowMatchingProperties && parentSchema.properties;
        const valid = gen.name("valid");
        if (it2.props !== true && !(it2.props instanceof codegen_1.Name)) {
          it2.props = (0, util_2.evaluatedPropsToName)(gen, it2.props);
        }
        const { props } = it2;
        validatePatternProperties();
        function validatePatternProperties() {
          for (const pat of patterns) {
            if (checkProperties)
              checkMatchingProperties(pat);
            if (it2.allErrors) {
              validateProperties(pat);
            } else {
              gen.var(valid, true);
              validateProperties(pat);
              gen.if(valid);
            }
          }
        }
        function checkMatchingProperties(pat) {
          for (const prop in checkProperties) {
            if (new RegExp(pat).test(prop)) {
              (0, util_1.checkStrictMode)(it2, `property ${prop} matches pattern ${pat} (use allowMatchingProperties)`);
            }
          }
        }
        function validateProperties(pat) {
          gen.forIn("key", data, (key) => {
            gen.if((0, codegen_1._)`${(0, code_1.usePattern)(cxt, pat)}.test(${key})`, () => {
              const alwaysValid = alwaysValidPatterns.includes(pat);
              if (!alwaysValid) {
                cxt.subschema({
                  keyword: "patternProperties",
                  schemaProp: pat,
                  dataProp: key,
                  dataPropType: util_2.Type.Str
                }, valid);
              }
              if (it2.opts.unevaluated && props !== true) {
                gen.assign((0, codegen_1._)`${props}[${key}]`, true);
              } else if (!alwaysValid && !it2.allErrors) {
                gen.if((0, codegen_1.not)(valid), () => gen.break());
              }
            });
          });
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/not.js
var require_not = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/not.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: "not",
      schemaType: ["object", "boolean"],
      trackErrors: true,
      code(cxt) {
        const { gen, schema, it: it2 } = cxt;
        if ((0, util_1.alwaysValidSchema)(it2, schema)) {
          cxt.fail();
          return;
        }
        const valid = gen.name("valid");
        cxt.subschema({
          keyword: "not",
          compositeRule: true,
          createErrors: false,
          allErrors: false
        }, valid);
        cxt.failResult(valid, () => cxt.reset(), () => cxt.error());
      },
      error: { message: "must NOT be valid" }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/anyOf.js
var require_anyOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/anyOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var def = {
      keyword: "anyOf",
      schemaType: "array",
      trackErrors: true,
      code: code_1.validateUnion,
      error: { message: "must match a schema in anyOf" }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/oneOf.js
var require_oneOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/oneOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: "must match exactly one schema in oneOf",
      params: ({ params }) => (0, codegen_1._)`{passingSchemas: ${params.passing}}`
    };
    var def = {
      keyword: "oneOf",
      schemaType: "array",
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema, parentSchema, it: it2 } = cxt;
        if (!Array.isArray(schema))
          throw new Error("ajv implementation error");
        if (it2.opts.discriminator && parentSchema.discriminator)
          return;
        const schArr = schema;
        const valid = gen.let("valid", false);
        const passing = gen.let("passing", null);
        const schValid = gen.name("_valid");
        cxt.setParams({ passing });
        gen.block(validateOneOf);
        cxt.result(valid, () => cxt.reset(), () => cxt.error(true));
        function validateOneOf() {
          schArr.forEach((sch, i) => {
            let schCxt;
            if ((0, util_1.alwaysValidSchema)(it2, sch)) {
              gen.var(schValid, true);
            } else {
              schCxt = cxt.subschema({
                keyword: "oneOf",
                schemaProp: i,
                compositeRule: true
              }, schValid);
            }
            if (i > 0) {
              gen.if((0, codegen_1._)`${schValid} && ${valid}`).assign(valid, false).assign(passing, (0, codegen_1._)`[${passing}, ${i}]`).else();
            }
            gen.if(schValid, () => {
              gen.assign(valid, true);
              gen.assign(passing, i);
              if (schCxt)
                cxt.mergeEvaluated(schCxt, codegen_1.Name);
            });
          });
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/allOf.js
var require_allOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/allOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: "allOf",
      schemaType: "array",
      code(cxt) {
        const { gen, schema, it: it2 } = cxt;
        if (!Array.isArray(schema))
          throw new Error("ajv implementation error");
        const valid = gen.name("valid");
        schema.forEach((sch, i) => {
          if ((0, util_1.alwaysValidSchema)(it2, sch))
            return;
          const schCxt = cxt.subschema({ keyword: "allOf", schemaProp: i }, valid);
          cxt.ok(valid);
          cxt.mergeEvaluated(schCxt);
        });
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/if.js
var require_if = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/if.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params }) => (0, codegen_1.str)`must match "${params.ifClause}" schema`,
      params: ({ params }) => (0, codegen_1._)`{failingKeyword: ${params.ifClause}}`
    };
    var def = {
      keyword: "if",
      schemaType: ["object", "boolean"],
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, parentSchema, it: it2 } = cxt;
        if (parentSchema.then === void 0 && parentSchema.else === void 0) {
          (0, util_1.checkStrictMode)(it2, '"if" without "then" and "else" is ignored');
        }
        const hasThen = hasSchema(it2, "then");
        const hasElse = hasSchema(it2, "else");
        if (!hasThen && !hasElse)
          return;
        const valid = gen.let("valid", true);
        const schValid = gen.name("_valid");
        validateIf();
        cxt.reset();
        if (hasThen && hasElse) {
          const ifClause = gen.let("ifClause");
          cxt.setParams({ ifClause });
          gen.if(schValid, validateClause("then", ifClause), validateClause("else", ifClause));
        } else if (hasThen) {
          gen.if(schValid, validateClause("then"));
        } else {
          gen.if((0, codegen_1.not)(schValid), validateClause("else"));
        }
        cxt.pass(valid, () => cxt.error(true));
        function validateIf() {
          const schCxt = cxt.subschema({
            keyword: "if",
            compositeRule: true,
            createErrors: false,
            allErrors: false
          }, schValid);
          cxt.mergeEvaluated(schCxt);
        }
        function validateClause(keyword, ifClause) {
          return () => {
            const schCxt = cxt.subschema({ keyword }, schValid);
            gen.assign(valid, schValid);
            cxt.mergeValidEvaluated(schCxt, valid);
            if (ifClause)
              gen.assign(ifClause, (0, codegen_1._)`${keyword}`);
            else
              cxt.setParams({ ifClause: keyword });
          };
        }
      }
    };
    function hasSchema(it2, keyword) {
      const schema = it2.schema[keyword];
      return schema !== void 0 && !(0, util_1.alwaysValidSchema)(it2, schema);
    }
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/thenElse.js
var require_thenElse = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/thenElse.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: ["then", "else"],
      schemaType: ["object", "boolean"],
      code({ keyword, parentSchema, it: it2 }) {
        if (parentSchema.if === void 0)
          (0, util_1.checkStrictMode)(it2, `"${keyword}" without "if" is ignored`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/index.js
var require_applicator = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var additionalItems_1 = require_additionalItems();
    var prefixItems_1 = require_prefixItems();
    var items_1 = require_items();
    var items2020_1 = require_items2020();
    var contains_1 = require_contains();
    var dependencies_1 = require_dependencies();
    var propertyNames_1 = require_propertyNames();
    var additionalProperties_1 = require_additionalProperties();
    var properties_1 = require_properties();
    var patternProperties_1 = require_patternProperties();
    var not_1 = require_not();
    var anyOf_1 = require_anyOf();
    var oneOf_1 = require_oneOf();
    var allOf_1 = require_allOf();
    var if_1 = require_if();
    var thenElse_1 = require_thenElse();
    function getApplicator(draft2020 = false) {
      const applicator = [
        // any
        not_1.default,
        anyOf_1.default,
        oneOf_1.default,
        allOf_1.default,
        if_1.default,
        thenElse_1.default,
        // object
        propertyNames_1.default,
        additionalProperties_1.default,
        dependencies_1.default,
        properties_1.default,
        patternProperties_1.default
      ];
      if (draft2020)
        applicator.push(prefixItems_1.default, items2020_1.default);
      else
        applicator.push(additionalItems_1.default, items_1.default);
      applicator.push(contains_1.default);
      return applicator;
    }
    exports.default = getApplicator;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/dynamicAnchor.js
var require_dynamicAnchor = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/dynamicAnchor.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.dynamicAnchor = void 0;
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var compile_1 = require_compile();
    var ref_1 = require_ref();
    var def = {
      keyword: "$dynamicAnchor",
      schemaType: "string",
      code: (cxt) => dynamicAnchor(cxt, cxt.schema)
    };
    function dynamicAnchor(cxt, anchor) {
      const { gen, it: it2 } = cxt;
      it2.schemaEnv.root.dynamicAnchors[anchor] = true;
      const v = (0, codegen_1._)`${names_1.default.dynamicAnchors}${(0, codegen_1.getProperty)(anchor)}`;
      const validate2 = it2.errSchemaPath === "#" ? it2.validateName : _getValidate(cxt);
      gen.if((0, codegen_1._)`!${v}`, () => gen.assign(v, validate2));
    }
    exports.dynamicAnchor = dynamicAnchor;
    function _getValidate(cxt) {
      const { schemaEnv, schema, self } = cxt.it;
      const { root, baseId, localRefs, meta } = schemaEnv.root;
      const { schemaId } = self.opts;
      const sch = new compile_1.SchemaEnv({ schema, schemaId, root, baseId, localRefs, meta });
      compile_1.compileSchema.call(self, sch);
      return (0, ref_1.getValidate)(cxt, sch);
    }
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/dynamicRef.js
var require_dynamicRef = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/dynamicRef.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.dynamicRef = void 0;
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var ref_1 = require_ref();
    var def = {
      keyword: "$dynamicRef",
      schemaType: "string",
      code: (cxt) => dynamicRef(cxt, cxt.schema)
    };
    function dynamicRef(cxt, ref) {
      const { gen, keyword, it: it2 } = cxt;
      if (ref[0] !== "#")
        throw new Error(`"${keyword}" only supports hash fragment reference`);
      const anchor = ref.slice(1);
      if (it2.allErrors) {
        _dynamicRef();
      } else {
        const valid = gen.let("valid", false);
        _dynamicRef(valid);
        cxt.ok(valid);
      }
      function _dynamicRef(valid) {
        if (it2.schemaEnv.root.dynamicAnchors[anchor]) {
          const v = gen.let("_v", (0, codegen_1._)`${names_1.default.dynamicAnchors}${(0, codegen_1.getProperty)(anchor)}`);
          gen.if(v, _callRef(v, valid), _callRef(it2.validateName, valid));
        } else {
          _callRef(it2.validateName, valid)();
        }
      }
      function _callRef(validate2, valid) {
        return valid ? () => gen.block(() => {
          (0, ref_1.callRef)(cxt, validate2);
          gen.let(valid, true);
        }) : () => (0, ref_1.callRef)(cxt, validate2);
      }
    }
    exports.dynamicRef = dynamicRef;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/recursiveAnchor.js
var require_recursiveAnchor = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/recursiveAnchor.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dynamicAnchor_1 = require_dynamicAnchor();
    var util_1 = require_util();
    var def = {
      keyword: "$recursiveAnchor",
      schemaType: "boolean",
      code(cxt) {
        if (cxt.schema)
          (0, dynamicAnchor_1.dynamicAnchor)(cxt, "");
        else
          (0, util_1.checkStrictMode)(cxt.it, "$recursiveAnchor: false is ignored");
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/recursiveRef.js
var require_recursiveRef = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/recursiveRef.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dynamicRef_1 = require_dynamicRef();
    var def = {
      keyword: "$recursiveRef",
      schemaType: "string",
      code: (cxt) => (0, dynamicRef_1.dynamicRef)(cxt, cxt.schema)
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/index.js
var require_dynamic = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dynamicAnchor_1 = require_dynamicAnchor();
    var dynamicRef_1 = require_dynamicRef();
    var recursiveAnchor_1 = require_recursiveAnchor();
    var recursiveRef_1 = require_recursiveRef();
    var dynamic = [dynamicAnchor_1.default, dynamicRef_1.default, recursiveAnchor_1.default, recursiveRef_1.default];
    exports.default = dynamic;
  }
});

// node_modules/ajv/dist/vocabularies/validation/dependentRequired.js
var require_dependentRequired = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/dependentRequired.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dependencies_1 = require_dependencies();
    var def = {
      keyword: "dependentRequired",
      type: "object",
      schemaType: "object",
      error: dependencies_1.error,
      code: (cxt) => (0, dependencies_1.validatePropertyDeps)(cxt)
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/dependentSchemas.js
var require_dependentSchemas = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/dependentSchemas.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dependencies_1 = require_dependencies();
    var def = {
      keyword: "dependentSchemas",
      type: "object",
      schemaType: "object",
      code: (cxt) => (0, dependencies_1.validateSchemaDeps)(cxt)
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitContains.js
var require_limitContains = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitContains.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: ["maxContains", "minContains"],
      type: "array",
      schemaType: "number",
      code({ keyword, parentSchema, it: it2 }) {
        if (parentSchema.contains === void 0) {
          (0, util_1.checkStrictMode)(it2, `"${keyword}" without "contains" is ignored`);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/next.js
var require_next = __commonJS({
  "node_modules/ajv/dist/vocabularies/next.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dependentRequired_1 = require_dependentRequired();
    var dependentSchemas_1 = require_dependentSchemas();
    var limitContains_1 = require_limitContains();
    var next = [dependentRequired_1.default, dependentSchemas_1.default, limitContains_1.default];
    exports.default = next;
  }
});

// node_modules/ajv/dist/vocabularies/unevaluated/unevaluatedProperties.js
var require_unevaluatedProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/unevaluated/unevaluatedProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var names_1 = require_names();
    var error = {
      message: "must NOT have unevaluated properties",
      params: ({ params }) => (0, codegen_1._)`{unevaluatedProperty: ${params.unevaluatedProperty}}`
    };
    var def = {
      keyword: "unevaluatedProperties",
      type: "object",
      schemaType: ["boolean", "object"],
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema, data, errsCount, it: it2 } = cxt;
        if (!errsCount)
          throw new Error("ajv implementation error");
        const { allErrors, props } = it2;
        if (props instanceof codegen_1.Name) {
          gen.if((0, codegen_1._)`${props} !== true`, () => gen.forIn("key", data, (key) => gen.if(unevaluatedDynamic(props, key), () => unevaluatedPropCode(key))));
        } else if (props !== true) {
          gen.forIn("key", data, (key) => props === void 0 ? unevaluatedPropCode(key) : gen.if(unevaluatedStatic(props, key), () => unevaluatedPropCode(key)));
        }
        it2.props = true;
        cxt.ok((0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
        function unevaluatedPropCode(key) {
          if (schema === false) {
            cxt.setParams({ unevaluatedProperty: key });
            cxt.error();
            if (!allErrors)
              gen.break();
            return;
          }
          if (!(0, util_1.alwaysValidSchema)(it2, schema)) {
            const valid = gen.name("valid");
            cxt.subschema({
              keyword: "unevaluatedProperties",
              dataProp: key,
              dataPropType: util_1.Type.Str
            }, valid);
            if (!allErrors)
              gen.if((0, codegen_1.not)(valid), () => gen.break());
          }
        }
        function unevaluatedDynamic(evaluatedProps, key) {
          return (0, codegen_1._)`!${evaluatedProps} || !${evaluatedProps}[${key}]`;
        }
        function unevaluatedStatic(evaluatedProps, key) {
          const ps = [];
          for (const p in evaluatedProps) {
            if (evaluatedProps[p] === true)
              ps.push((0, codegen_1._)`${key} !== ${p}`);
          }
          return (0, codegen_1.and)(...ps);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/unevaluated/unevaluatedItems.js
var require_unevaluatedItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/unevaluated/unevaluatedItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    };
    var def = {
      keyword: "unevaluatedItems",
      type: "array",
      schemaType: ["boolean", "object"],
      error,
      code(cxt) {
        const { gen, schema, data, it: it2 } = cxt;
        const items = it2.items || 0;
        if (items === true)
          return;
        const len = gen.const("len", (0, codegen_1._)`${data}.length`);
        if (schema === false) {
          cxt.setParams({ len: items });
          cxt.fail((0, codegen_1._)`${len} > ${items}`);
        } else if (typeof schema == "object" && !(0, util_1.alwaysValidSchema)(it2, schema)) {
          const valid = gen.var("valid", (0, codegen_1._)`${len} <= ${items}`);
          gen.if((0, codegen_1.not)(valid), () => validateItems(valid, items));
          cxt.ok(valid);
        }
        it2.items = true;
        function validateItems(valid, from) {
          gen.forRange("i", from, len, (i) => {
            cxt.subschema({ keyword: "unevaluatedItems", dataProp: i, dataPropType: util_1.Type.Num }, valid);
            if (!it2.allErrors)
              gen.if((0, codegen_1.not)(valid), () => gen.break());
          });
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/unevaluated/index.js
var require_unevaluated = __commonJS({
  "node_modules/ajv/dist/vocabularies/unevaluated/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var unevaluatedProperties_1 = require_unevaluatedProperties();
    var unevaluatedItems_1 = require_unevaluatedItems();
    var unevaluated = [unevaluatedProperties_1.default, unevaluatedItems_1.default];
    exports.default = unevaluated;
  }
});

// node_modules/ajv/dist/vocabularies/format/format.js
var require_format = __commonJS({
  "node_modules/ajv/dist/vocabularies/format/format.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must match format "${schemaCode}"`,
      params: ({ schemaCode }) => (0, codegen_1._)`{format: ${schemaCode}}`
    };
    var def = {
      keyword: "format",
      type: ["number", "string"],
      schemaType: "string",
      $data: true,
      error,
      code(cxt, ruleType) {
        const { gen, data, $data, schema, schemaCode, it: it2 } = cxt;
        const { opts, errSchemaPath, schemaEnv, self } = it2;
        if (!opts.validateFormats)
          return;
        if ($data)
          validate$DataFormat();
        else
          validateFormat();
        function validate$DataFormat() {
          const fmts = gen.scopeValue("formats", {
            ref: self.formats,
            code: opts.code.formats
          });
          const fDef = gen.const("fDef", (0, codegen_1._)`${fmts}[${schemaCode}]`);
          const fType = gen.let("fType");
          const format = gen.let("format");
          gen.if((0, codegen_1._)`typeof ${fDef} == "object" && !(${fDef} instanceof RegExp)`, () => gen.assign(fType, (0, codegen_1._)`${fDef}.type || "string"`).assign(format, (0, codegen_1._)`${fDef}.validate`), () => gen.assign(fType, (0, codegen_1._)`"string"`).assign(format, fDef));
          cxt.fail$data((0, codegen_1.or)(unknownFmt(), invalidFmt()));
          function unknownFmt() {
            if (opts.strictSchema === false)
              return codegen_1.nil;
            return (0, codegen_1._)`${schemaCode} && !${format}`;
          }
          function invalidFmt() {
            const callFormat = schemaEnv.$async ? (0, codegen_1._)`(${fDef}.async ? await ${format}(${data}) : ${format}(${data}))` : (0, codegen_1._)`${format}(${data})`;
            const validData = (0, codegen_1._)`(typeof ${format} == "function" ? ${callFormat} : ${format}.test(${data}))`;
            return (0, codegen_1._)`${format} && ${format} !== true && ${fType} === ${ruleType} && !${validData}`;
          }
        }
        function validateFormat() {
          const formatDef = self.formats[schema];
          if (!formatDef) {
            unknownFormat();
            return;
          }
          if (formatDef === true)
            return;
          const [fmtType, format, fmtRef] = getFormat(formatDef);
          if (fmtType === ruleType)
            cxt.pass(validCondition());
          function unknownFormat() {
            if (opts.strictSchema === false) {
              self.logger.warn(unknownMsg());
              return;
            }
            throw new Error(unknownMsg());
            function unknownMsg() {
              return `unknown format "${schema}" ignored in schema at path "${errSchemaPath}"`;
            }
          }
          function getFormat(fmtDef) {
            const code = fmtDef instanceof RegExp ? (0, codegen_1.regexpCode)(fmtDef) : opts.code.formats ? (0, codegen_1._)`${opts.code.formats}${(0, codegen_1.getProperty)(schema)}` : void 0;
            const fmt = gen.scopeValue("formats", { key: schema, ref: fmtDef, code });
            if (typeof fmtDef == "object" && !(fmtDef instanceof RegExp)) {
              return [fmtDef.type || "string", fmtDef.validate, (0, codegen_1._)`${fmt}.validate`];
            }
            return ["string", fmtDef, fmt];
          }
          function validCondition() {
            if (typeof formatDef == "object" && !(formatDef instanceof RegExp) && formatDef.async) {
              if (!schemaEnv.$async)
                throw new Error("async format in sync schema");
              return (0, codegen_1._)`await ${fmtRef}(${data})`;
            }
            return typeof format == "function" ? (0, codegen_1._)`${fmtRef}(${data})` : (0, codegen_1._)`${fmtRef}.test(${data})`;
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/format/index.js
var require_format2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/format/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var format_1 = require_format();
    var format = [format_1.default];
    exports.default = format;
  }
});

// node_modules/ajv/dist/vocabularies/metadata.js
var require_metadata = __commonJS({
  "node_modules/ajv/dist/vocabularies/metadata.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.contentVocabulary = exports.metadataVocabulary = void 0;
    exports.metadataVocabulary = [
      "title",
      "description",
      "default",
      "deprecated",
      "readOnly",
      "writeOnly",
      "examples"
    ];
    exports.contentVocabulary = [
      "contentMediaType",
      "contentEncoding",
      "contentSchema"
    ];
  }
});

// node_modules/ajv/dist/vocabularies/draft2020.js
var require_draft2020 = __commonJS({
  "node_modules/ajv/dist/vocabularies/draft2020.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var core_1 = require_core2();
    var validation_1 = require_validation();
    var applicator_1 = require_applicator();
    var dynamic_1 = require_dynamic();
    var next_1 = require_next();
    var unevaluated_1 = require_unevaluated();
    var format_1 = require_format2();
    var metadata_1 = require_metadata();
    var draft2020Vocabularies = [
      dynamic_1.default,
      core_1.default,
      validation_1.default,
      (0, applicator_1.default)(true),
      format_1.default,
      metadata_1.metadataVocabulary,
      metadata_1.contentVocabulary,
      next_1.default,
      unevaluated_1.default
    ];
    exports.default = draft2020Vocabularies;
  }
});

// node_modules/ajv/dist/vocabularies/discriminator/types.js
var require_types = __commonJS({
  "node_modules/ajv/dist/vocabularies/discriminator/types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DiscrError = void 0;
    var DiscrError;
    (function(DiscrError2) {
      DiscrError2["Tag"] = "tag";
      DiscrError2["Mapping"] = "mapping";
    })(DiscrError || (exports.DiscrError = DiscrError = {}));
  }
});

// node_modules/ajv/dist/vocabularies/discriminator/index.js
var require_discriminator = __commonJS({
  "node_modules/ajv/dist/vocabularies/discriminator/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var types_1 = require_types();
    var compile_1 = require_compile();
    var ref_error_1 = require_ref_error();
    var util_1 = require_util();
    var error = {
      message: ({ params: { discrError, tagName } }) => discrError === types_1.DiscrError.Tag ? `tag "${tagName}" must be string` : `value of tag "${tagName}" must be in oneOf`,
      params: ({ params: { discrError, tag, tagName } }) => (0, codegen_1._)`{error: ${discrError}, tag: ${tagName}, tagValue: ${tag}}`
    };
    var def = {
      keyword: "discriminator",
      type: "object",
      schemaType: "object",
      error,
      code(cxt) {
        const { gen, data, schema, parentSchema, it: it2 } = cxt;
        const { oneOf } = parentSchema;
        if (!it2.opts.discriminator) {
          throw new Error("discriminator: requires discriminator option");
        }
        const tagName = schema.propertyName;
        if (typeof tagName != "string")
          throw new Error("discriminator: requires propertyName");
        if (schema.mapping)
          throw new Error("discriminator: mapping is not supported");
        if (!oneOf)
          throw new Error("discriminator: requires oneOf keyword");
        const valid = gen.let("valid", false);
        const tag = gen.const("tag", (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(tagName)}`);
        gen.if((0, codegen_1._)`typeof ${tag} == "string"`, () => validateMapping(), () => cxt.error(false, { discrError: types_1.DiscrError.Tag, tag, tagName }));
        cxt.ok(valid);
        function validateMapping() {
          const mapping = getMapping();
          gen.if(false);
          for (const tagValue in mapping) {
            gen.elseIf((0, codegen_1._)`${tag} === ${tagValue}`);
            gen.assign(valid, applyTagSchema(mapping[tagValue]));
          }
          gen.else();
          cxt.error(false, { discrError: types_1.DiscrError.Mapping, tag, tagName });
          gen.endIf();
        }
        function applyTagSchema(schemaProp) {
          const _valid = gen.name("valid");
          const schCxt = cxt.subschema({ keyword: "oneOf", schemaProp }, _valid);
          cxt.mergeEvaluated(schCxt, codegen_1.Name);
          return _valid;
        }
        function getMapping() {
          var _a;
          const oneOfMapping = {};
          const topRequired = hasRequired(parentSchema);
          let tagRequired = true;
          for (let i = 0; i < oneOf.length; i++) {
            let sch = oneOf[i];
            if ((sch === null || sch === void 0 ? void 0 : sch.$ref) && !(0, util_1.schemaHasRulesButRef)(sch, it2.self.RULES)) {
              const ref = sch.$ref;
              sch = compile_1.resolveRef.call(it2.self, it2.schemaEnv.root, it2.baseId, ref);
              if (sch instanceof compile_1.SchemaEnv)
                sch = sch.schema;
              if (sch === void 0)
                throw new ref_error_1.default(it2.opts.uriResolver, it2.baseId, ref);
            }
            const propSch = (_a = sch === null || sch === void 0 ? void 0 : sch.properties) === null || _a === void 0 ? void 0 : _a[tagName];
            if (typeof propSch != "object") {
              throw new Error(`discriminator: oneOf subschemas (or referenced schemas) must have "properties/${tagName}"`);
            }
            tagRequired = tagRequired && (topRequired || hasRequired(sch));
            addMappings(propSch, i);
          }
          if (!tagRequired)
            throw new Error(`discriminator: "${tagName}" must be required`);
          return oneOfMapping;
          function hasRequired({ required: required2 }) {
            return Array.isArray(required2) && required2.includes(tagName);
          }
          function addMappings(sch, i) {
            if (sch.const) {
              addMapping(sch.const, i);
            } else if (sch.enum) {
              for (const tagValue of sch.enum) {
                addMapping(tagValue, i);
              }
            } else {
              throw new Error(`discriminator: "properties/${tagName}" must have "const" or "enum"`);
            }
          }
          function addMapping(tagValue, i) {
            if (typeof tagValue != "string" || tagValue in oneOfMapping) {
              throw new Error(`discriminator: "${tagName}" values must be unique strings`);
            }
            oneOfMapping[tagValue] = i;
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/schema.json
var require_schema = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/schema.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/schema",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/core": true,
        "https://json-schema.org/draft/2020-12/vocab/applicator": true,
        "https://json-schema.org/draft/2020-12/vocab/unevaluated": true,
        "https://json-schema.org/draft/2020-12/vocab/validation": true,
        "https://json-schema.org/draft/2020-12/vocab/meta-data": true,
        "https://json-schema.org/draft/2020-12/vocab/format-annotation": true,
        "https://json-schema.org/draft/2020-12/vocab/content": true
      },
      $dynamicAnchor: "meta",
      title: "Core and Validation specifications meta-schema",
      allOf: [
        { $ref: "meta/core" },
        { $ref: "meta/applicator" },
        { $ref: "meta/unevaluated" },
        { $ref: "meta/validation" },
        { $ref: "meta/meta-data" },
        { $ref: "meta/format-annotation" },
        { $ref: "meta/content" }
      ],
      type: ["object", "boolean"],
      $comment: "This meta-schema also defines keywords that have appeared in previous drafts in order to prevent incompatible extensions as they remain in common use.",
      properties: {
        definitions: {
          $comment: '"definitions" has been replaced by "$defs".',
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" },
          deprecated: true,
          default: {}
        },
        dependencies: {
          $comment: '"dependencies" has been split and replaced by "dependentSchemas" and "dependentRequired" in order to serve their differing semantics.',
          type: "object",
          additionalProperties: {
            anyOf: [{ $dynamicRef: "#meta" }, { $ref: "meta/validation#/$defs/stringArray" }]
          },
          deprecated: true,
          default: {}
        },
        $recursiveAnchor: {
          $comment: '"$recursiveAnchor" has been replaced by "$dynamicAnchor".',
          $ref: "meta/core#/$defs/anchorString",
          deprecated: true
        },
        $recursiveRef: {
          $comment: '"$recursiveRef" has been replaced by "$dynamicRef".',
          $ref: "meta/core#/$defs/uriReferenceString",
          deprecated: true
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/applicator.json
var require_applicator2 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/applicator.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/applicator",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/applicator": true
      },
      $dynamicAnchor: "meta",
      title: "Applicator vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        prefixItems: { $ref: "#/$defs/schemaArray" },
        items: { $dynamicRef: "#meta" },
        contains: { $dynamicRef: "#meta" },
        additionalProperties: { $dynamicRef: "#meta" },
        properties: {
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" },
          default: {}
        },
        patternProperties: {
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" },
          propertyNames: { format: "regex" },
          default: {}
        },
        dependentSchemas: {
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" },
          default: {}
        },
        propertyNames: { $dynamicRef: "#meta" },
        if: { $dynamicRef: "#meta" },
        then: { $dynamicRef: "#meta" },
        else: { $dynamicRef: "#meta" },
        allOf: { $ref: "#/$defs/schemaArray" },
        anyOf: { $ref: "#/$defs/schemaArray" },
        oneOf: { $ref: "#/$defs/schemaArray" },
        not: { $dynamicRef: "#meta" }
      },
      $defs: {
        schemaArray: {
          type: "array",
          minItems: 1,
          items: { $dynamicRef: "#meta" }
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/unevaluated.json
var require_unevaluated2 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/unevaluated.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/unevaluated",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/unevaluated": true
      },
      $dynamicAnchor: "meta",
      title: "Unevaluated applicator vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        unevaluatedItems: { $dynamicRef: "#meta" },
        unevaluatedProperties: { $dynamicRef: "#meta" }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/content.json
var require_content = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/content.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/content",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/content": true
      },
      $dynamicAnchor: "meta",
      title: "Content vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        contentEncoding: { type: "string" },
        contentMediaType: { type: "string" },
        contentSchema: { $dynamicRef: "#meta" }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/core.json
var require_core3 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/core.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/core",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/core": true
      },
      $dynamicAnchor: "meta",
      title: "Core vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        $id: {
          $ref: "#/$defs/uriReferenceString",
          $comment: "Non-empty fragments not allowed.",
          pattern: "^[^#]*#?$"
        },
        $schema: { $ref: "#/$defs/uriString" },
        $ref: { $ref: "#/$defs/uriReferenceString" },
        $anchor: { $ref: "#/$defs/anchorString" },
        $dynamicRef: { $ref: "#/$defs/uriReferenceString" },
        $dynamicAnchor: { $ref: "#/$defs/anchorString" },
        $vocabulary: {
          type: "object",
          propertyNames: { $ref: "#/$defs/uriString" },
          additionalProperties: {
            type: "boolean"
          }
        },
        $comment: {
          type: "string"
        },
        $defs: {
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" }
        }
      },
      $defs: {
        anchorString: {
          type: "string",
          pattern: "^[A-Za-z_][-A-Za-z0-9._]*$"
        },
        uriString: {
          type: "string",
          format: "uri"
        },
        uriReferenceString: {
          type: "string",
          format: "uri-reference"
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/format-annotation.json
var require_format_annotation = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/format-annotation.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/format-annotation",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/format-annotation": true
      },
      $dynamicAnchor: "meta",
      title: "Format vocabulary meta-schema for annotation results",
      type: ["object", "boolean"],
      properties: {
        format: { type: "string" }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/meta-data.json
var require_meta_data = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/meta-data.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/meta-data",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/meta-data": true
      },
      $dynamicAnchor: "meta",
      title: "Meta-data vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        title: {
          type: "string"
        },
        description: {
          type: "string"
        },
        default: true,
        deprecated: {
          type: "boolean",
          default: false
        },
        readOnly: {
          type: "boolean",
          default: false
        },
        writeOnly: {
          type: "boolean",
          default: false
        },
        examples: {
          type: "array",
          items: true
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/validation.json
var require_validation2 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/validation.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/validation",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/validation": true
      },
      $dynamicAnchor: "meta",
      title: "Validation vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        type: {
          anyOf: [
            { $ref: "#/$defs/simpleTypes" },
            {
              type: "array",
              items: { $ref: "#/$defs/simpleTypes" },
              minItems: 1,
              uniqueItems: true
            }
          ]
        },
        const: true,
        enum: {
          type: "array",
          items: true
        },
        multipleOf: {
          type: "number",
          exclusiveMinimum: 0
        },
        maximum: {
          type: "number"
        },
        exclusiveMaximum: {
          type: "number"
        },
        minimum: {
          type: "number"
        },
        exclusiveMinimum: {
          type: "number"
        },
        maxLength: { $ref: "#/$defs/nonNegativeInteger" },
        minLength: { $ref: "#/$defs/nonNegativeIntegerDefault0" },
        pattern: {
          type: "string",
          format: "regex"
        },
        maxItems: { $ref: "#/$defs/nonNegativeInteger" },
        minItems: { $ref: "#/$defs/nonNegativeIntegerDefault0" },
        uniqueItems: {
          type: "boolean",
          default: false
        },
        maxContains: { $ref: "#/$defs/nonNegativeInteger" },
        minContains: {
          $ref: "#/$defs/nonNegativeInteger",
          default: 1
        },
        maxProperties: { $ref: "#/$defs/nonNegativeInteger" },
        minProperties: { $ref: "#/$defs/nonNegativeIntegerDefault0" },
        required: { $ref: "#/$defs/stringArray" },
        dependentRequired: {
          type: "object",
          additionalProperties: {
            $ref: "#/$defs/stringArray"
          }
        }
      },
      $defs: {
        nonNegativeInteger: {
          type: "integer",
          minimum: 0
        },
        nonNegativeIntegerDefault0: {
          $ref: "#/$defs/nonNegativeInteger",
          default: 0
        },
        simpleTypes: {
          enum: ["array", "boolean", "integer", "null", "number", "object", "string"]
        },
        stringArray: {
          type: "array",
          items: { type: "string" },
          uniqueItems: true,
          default: []
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/index.js
var require_json_schema_2020_12 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var metaSchema = require_schema();
    var applicator = require_applicator2();
    var unevaluated = require_unevaluated2();
    var content = require_content();
    var core = require_core3();
    var format = require_format_annotation();
    var metadata = require_meta_data();
    var validation = require_validation2();
    var META_SUPPORT_DATA = ["/properties"];
    function addMetaSchema2020($data) {
      ;
      [
        metaSchema,
        applicator,
        unevaluated,
        content,
        core,
        with$data(this, format),
        metadata,
        with$data(this, validation)
      ].forEach((sch) => this.addMetaSchema(sch, void 0, false));
      return this;
      function with$data(ajv2, sch) {
        return $data ? ajv2.$dataMetaSchema(sch, META_SUPPORT_DATA) : sch;
      }
    }
    exports.default = addMetaSchema2020;
  }
});

// node_modules/ajv/dist/2020.js
var require__ = __commonJS({
  "node_modules/ajv/dist/2020.js"(exports, module) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MissingRefError = exports.ValidationError = exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = exports.Ajv2020 = void 0;
    var core_1 = require_core();
    var draft2020_1 = require_draft2020();
    var discriminator_1 = require_discriminator();
    var json_schema_2020_12_1 = require_json_schema_2020_12();
    var META_SCHEMA_ID = "https://json-schema.org/draft/2020-12/schema";
    var Ajv20203 = class extends core_1.default {
      constructor(opts = {}) {
        super({
          ...opts,
          dynamicRef: true,
          next: true,
          unevaluated: true
        });
      }
      _addVocabularies() {
        super._addVocabularies();
        draft2020_1.default.forEach((v) => this.addVocabulary(v));
        if (this.opts.discriminator)
          this.addKeyword(discriminator_1.default);
      }
      _addDefaultMetaSchema() {
        super._addDefaultMetaSchema();
        const { $data, meta } = this.opts;
        if (!meta)
          return;
        json_schema_2020_12_1.default.call(this, $data);
        this.refs["http://json-schema.org/schema"] = META_SCHEMA_ID;
      }
      defaultMeta() {
        return this.opts.defaultMeta = super.defaultMeta() || (this.getSchema(META_SCHEMA_ID) ? META_SCHEMA_ID : void 0);
      }
    };
    exports.Ajv2020 = Ajv20203;
    module.exports = exports = Ajv20203;
    module.exports.Ajv2020 = Ajv20203;
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = Ajv20203;
    var validate_1 = require_validate();
    Object.defineProperty(exports, "KeywordCxt", { enumerable: true, get: function() {
      return validate_1.KeywordCxt;
    } });
    var codegen_1 = require_codegen();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return codegen_1._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return codegen_1.str;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return codegen_1.stringify;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return codegen_1.nil;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return codegen_1.Name;
    } });
    Object.defineProperty(exports, "CodeGen", { enumerable: true, get: function() {
      return codegen_1.CodeGen;
    } });
    var validation_error_1 = require_validation_error();
    Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function() {
      return validation_error_1.default;
    } });
    var ref_error_1 = require_ref_error();
    Object.defineProperty(exports, "MissingRefError", { enumerable: true, get: function() {
      return ref_error_1.default;
    } });
  }
});

// node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS({
  "node_modules/yaml/dist/nodes/identity.js"(exports) {
    "use strict";
    var ALIAS = /* @__PURE__ */ Symbol.for("yaml.alias");
    var DOC = /* @__PURE__ */ Symbol.for("yaml.document");
    var MAP = /* @__PURE__ */ Symbol.for("yaml.map");
    var PAIR = /* @__PURE__ */ Symbol.for("yaml.pair");
    var SCALAR = /* @__PURE__ */ Symbol.for("yaml.scalar");
    var SEQ = /* @__PURE__ */ Symbol.for("yaml.seq");
    var NODE_TYPE = /* @__PURE__ */ Symbol.for("yaml.node.type");
    var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
    var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
    var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
    var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
    var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
    var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
    function isCollection(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case MAP:
          case SEQ:
            return true;
        }
      return false;
    }
    function isNode(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case ALIAS:
          case MAP:
          case SCALAR:
          case SEQ:
            return true;
        }
      return false;
    }
    var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
    exports.ALIAS = ALIAS;
    exports.DOC = DOC;
    exports.MAP = MAP;
    exports.NODE_TYPE = NODE_TYPE;
    exports.PAIR = PAIR;
    exports.SCALAR = SCALAR;
    exports.SEQ = SEQ;
    exports.hasAnchor = hasAnchor;
    exports.isAlias = isAlias;
    exports.isCollection = isCollection;
    exports.isDocument = isDocument;
    exports.isMap = isMap;
    exports.isNode = isNode;
    exports.isPair = isPair;
    exports.isScalar = isScalar;
    exports.isSeq = isSeq;
  }
});

// node_modules/yaml/dist/visit.js
var require_visit = __commonJS({
  "node_modules/yaml/dist/visit.js"(exports) {
    "use strict";
    var identity = require_identity();
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove node");
    function visit(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        visit_(null, node, visitor_, Object.freeze([]));
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    function visit_(key, node, visitor, path) {
      const ctrl = callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visit_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = visit_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = visit_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = visit_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    async function visitAsync(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        await visitAsync_(null, node, visitor_, Object.freeze([]));
    }
    visitAsync.BREAK = BREAK;
    visitAsync.SKIP = SKIP;
    visitAsync.REMOVE = REMOVE;
    async function visitAsync_(key, node, visitor, path) {
      const ctrl = await callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visitAsync_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = await visitAsync_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = await visitAsync_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = await visitAsync_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    function initVisitor(visitor) {
      if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
        return Object.assign({
          Alias: visitor.Node,
          Map: visitor.Node,
          Scalar: visitor.Node,
          Seq: visitor.Node
        }, visitor.Value && {
          Map: visitor.Value,
          Scalar: visitor.Value,
          Seq: visitor.Value
        }, visitor.Collection && {
          Map: visitor.Collection,
          Seq: visitor.Collection
        }, visitor);
      }
      return visitor;
    }
    function callVisitor(key, node, visitor, path) {
      if (typeof visitor === "function")
        return visitor(key, node, path);
      if (identity.isMap(node))
        return visitor.Map?.(key, node, path);
      if (identity.isSeq(node))
        return visitor.Seq?.(key, node, path);
      if (identity.isPair(node))
        return visitor.Pair?.(key, node, path);
      if (identity.isScalar(node))
        return visitor.Scalar?.(key, node, path);
      if (identity.isAlias(node))
        return visitor.Alias?.(key, node, path);
      return void 0;
    }
    function replaceNode(key, path, node) {
      const parent = path[path.length - 1];
      if (identity.isCollection(parent)) {
        parent.items[key] = node;
      } else if (identity.isPair(parent)) {
        if (key === "key")
          parent.key = node;
        else
          parent.value = node;
      } else if (identity.isDocument(parent)) {
        parent.contents = node;
      } else {
        const pt3 = identity.isAlias(parent) ? "alias" : "scalar";
        throw new Error(`Cannot replace node with ${pt3} parent`);
      }
    }
    exports.visit = visit;
    exports.visitAsync = visitAsync;
  }
});

// node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS({
  "node_modules/yaml/dist/doc/directives.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    var escapeChars = {
      "!": "%21",
      ",": "%2C",
      "[": "%5B",
      "]": "%5D",
      "{": "%7B",
      "}": "%7D"
    };
    var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
    var Directives = class _Directives {
      constructor(yaml, tags) {
        this.docStart = null;
        this.docEnd = false;
        this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
        this.tags = Object.assign({}, _Directives.defaultTags, tags);
      }
      clone() {
        const copy3 = new _Directives(this.yaml, this.tags);
        copy3.docStart = this.docStart;
        return copy3;
      }
      /**
       * During parsing, get a Directives instance for the current document and
       * update the stream state according to the current version's spec.
       */
      atDocument() {
        const res = new _Directives(this.yaml, this.tags);
        switch (this.yaml.version) {
          case "1.1":
            this.atNextDocument = true;
            break;
          case "1.2":
            this.atNextDocument = false;
            this.yaml = {
              explicit: _Directives.defaultYaml.explicit,
              version: "1.2"
            };
            this.tags = Object.assign({}, _Directives.defaultTags);
            break;
        }
        return res;
      }
      /**
       * @param onError - May be called even if the action was successful
       * @returns `true` on success
       */
      add(line, onError) {
        if (this.atNextDocument) {
          this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
          this.tags = Object.assign({}, _Directives.defaultTags);
          this.atNextDocument = false;
        }
        const parts = line.trim().split(/[ \t]+/);
        const name = parts.shift();
        switch (name) {
          case "%TAG": {
            if (parts.length !== 2) {
              onError(0, "%TAG directive should contain exactly two parts");
              if (parts.length < 2)
                return false;
            }
            const [handle, prefix] = parts;
            this.tags[handle] = prefix;
            return true;
          }
          case "%YAML": {
            this.yaml.explicit = true;
            if (parts.length !== 1) {
              onError(0, "%YAML directive should contain exactly one part");
              return false;
            }
            const [version] = parts;
            if (version === "1.1" || version === "1.2") {
              this.yaml.version = version;
              return true;
            } else {
              const isValid = /^\d+\.\d+$/.test(version);
              onError(6, `Unsupported YAML version ${version}`, isValid);
              return false;
            }
          }
          default:
            onError(0, `Unknown directive ${name}`, true);
            return false;
        }
      }
      /**
       * Resolves a tag, matching handles to those defined in %TAG directives.
       *
       * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
       *   `'!local'` tag, or `null` if unresolvable.
       */
      tagName(source, onError) {
        if (source === "!")
          return "!";
        if (source[0] !== "!") {
          onError(`Not a valid tag: ${source}`);
          return null;
        }
        if (source[1] === "<") {
          const verbatim = source.slice(2, -1);
          if (verbatim === "!" || verbatim === "!!") {
            onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
            return null;
          }
          if (source[source.length - 1] !== ">")
            onError("Verbatim tags must end with a >");
          return verbatim;
        }
        const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
        if (!suffix)
          onError(`The ${source} tag has no suffix`);
        const prefix = this.tags[handle];
        if (prefix) {
          try {
            return prefix + decodeURIComponent(suffix);
          } catch (error) {
            onError(String(error));
            return null;
          }
        }
        if (handle === "!")
          return source;
        onError(`Could not resolve tag: ${source}`);
        return null;
      }
      /**
       * Given a fully resolved tag, returns its printable string form,
       * taking into account current tag prefixes and defaults.
       */
      tagString(tag) {
        for (const [handle, prefix] of Object.entries(this.tags)) {
          if (tag.startsWith(prefix))
            return handle + escapeTagName(tag.substring(prefix.length));
        }
        return tag[0] === "!" ? tag : `!<${tag}>`;
      }
      toString(doc) {
        const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
        const tagEntries = Object.entries(this.tags);
        let tagNames;
        if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
          const tags = {};
          visit.visit(doc.contents, (_key, node) => {
            if (identity.isNode(node) && node.tag)
              tags[node.tag] = true;
          });
          tagNames = Object.keys(tags);
        } else
          tagNames = [];
        for (const [handle, prefix] of tagEntries) {
          if (handle === "!!" && prefix === "tag:yaml.org,2002:")
            continue;
          if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
            lines.push(`%TAG ${handle} ${prefix}`);
        }
        return lines.join("\n");
      }
    };
    Directives.defaultYaml = { explicit: false, version: "1.2" };
    Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
    exports.Directives = Directives;
  }
});

// node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS({
  "node_modules/yaml/dist/doc/anchors.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    function anchorIsValid(anchor) {
      if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
        const sa = JSON.stringify(anchor);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
      }
      return true;
    }
    function anchorNames(root) {
      const anchors = /* @__PURE__ */ new Set();
      visit.visit(root, {
        Value(_key, node) {
          if (node.anchor)
            anchors.add(node.anchor);
        }
      });
      return anchors;
    }
    function findNewAnchor(prefix, exclude) {
      for (let i = 1; true; ++i) {
        const name = `${prefix}${i}`;
        if (!exclude.has(name))
          return name;
      }
    }
    function createNodeAnchors(doc, prefix) {
      const aliasObjects = [];
      const sourceObjects = /* @__PURE__ */ new Map();
      let prevAnchors = null;
      return {
        onAnchor: (source) => {
          aliasObjects.push(source);
          prevAnchors ?? (prevAnchors = anchorNames(doc));
          const anchor = findNewAnchor(prefix, prevAnchors);
          prevAnchors.add(anchor);
          return anchor;
        },
        /**
         * With circular references, the source node is only resolved after all
         * of its child nodes are. This is why anchors are set only after all of
         * the nodes have been created.
         */
        setAnchors: () => {
          for (const source of aliasObjects) {
            const ref = sourceObjects.get(source);
            if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
              ref.node.anchor = ref.anchor;
            } else {
              const error = new Error("Failed to resolve repeated object (this should not happen)");
              error.source = source;
              throw error;
            }
          }
        },
        sourceObjects
      };
    }
    exports.anchorIsValid = anchorIsValid;
    exports.anchorNames = anchorNames;
    exports.createNodeAnchors = createNodeAnchors;
    exports.findNewAnchor = findNewAnchor;
  }
});

// node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS({
  "node_modules/yaml/dist/doc/applyReviver.js"(exports) {
    "use strict";
    function applyReviver(reviver, obj, key, val) {
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (let i = 0, len = val.length; i < len; ++i) {
            const v0 = val[i];
            const v1 = applyReviver(reviver, val, String(i), v0);
            if (v1 === void 0)
              delete val[i];
            else if (v1 !== v0)
              val[i] = v1;
          }
        } else if (val instanceof Map) {
          for (const k2 of Array.from(val.keys())) {
            const v0 = val.get(k2);
            const v1 = applyReviver(reviver, val, k2, v0);
            if (v1 === void 0)
              val.delete(k2);
            else if (v1 !== v0)
              val.set(k2, v1);
          }
        } else if (val instanceof Set) {
          for (const v0 of Array.from(val)) {
            const v1 = applyReviver(reviver, val, v0, v0);
            if (v1 === void 0)
              val.delete(v0);
            else if (v1 !== v0) {
              val.delete(v0);
              val.add(v1);
            }
          }
        } else {
          for (const [k2, v0] of Object.entries(val)) {
            const v1 = applyReviver(reviver, val, k2, v0);
            if (v1 === void 0)
              delete val[k2];
            else if (v1 !== v0)
              val[k2] = v1;
          }
        }
      }
      return reviver.call(obj, key, val);
    }
    exports.applyReviver = applyReviver;
  }
});

// node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS({
  "node_modules/yaml/dist/nodes/toJS.js"(exports) {
    "use strict";
    var identity = require_identity();
    function toJS(value, arg, ctx) {
      if (Array.isArray(value))
        return value.map((v, i) => toJS(v, String(i), ctx));
      if (value && typeof value.toJSON === "function") {
        if (!ctx || !identity.hasAnchor(value))
          return value.toJSON(arg, ctx);
        const data = { aliasCount: 0, count: 1, res: void 0 };
        ctx.anchors.set(value, data);
        ctx.onCreate = (res2) => {
          data.res = res2;
          delete ctx.onCreate;
        };
        const res = value.toJSON(arg, ctx);
        if (ctx.onCreate)
          ctx.onCreate(res);
        return res;
      }
      if (typeof value === "bigint" && !ctx?.keep)
        return Number(value);
      return value;
    }
    exports.toJS = toJS;
  }
});

// node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS({
  "node_modules/yaml/dist/nodes/Node.js"(exports) {
    "use strict";
    var applyReviver = require_applyReviver();
    var identity = require_identity();
    var toJS = require_toJS();
    var NodeBase = class {
      constructor(type) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: type });
      }
      /** Create a copy of this node.  */
      clone() {
        const copy3 = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (this.range)
          copy3.range = this.range.slice();
        return copy3;
      }
      /** A plain JavaScript representation of this node. */
      toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        if (!identity.isDocument(doc))
          throw new TypeError("A document argument is required");
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc,
          keep: true,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this, "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
    };
    exports.NodeBase = NodeBase;
  }
});

// node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS({
  "node_modules/yaml/dist/nodes/Alias.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var visit = require_visit();
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var Alias = class extends Node.NodeBase {
      constructor(source) {
        super(identity.ALIAS);
        this.source = source;
        Object.defineProperty(this, "tag", {
          set() {
            throw new Error("Alias nodes cannot have tags");
          }
        });
      }
      /**
       * Resolve the value of this alias within `doc`, finding the last
       * instance of the `source` anchor before this node.
       */
      resolve(doc, ctx) {
        if (ctx?.maxAliasCount === 0)
          throw new ReferenceError("Alias resolution is disabled");
        let nodes;
        if (ctx?.aliasResolveCache) {
          nodes = ctx.aliasResolveCache;
        } else {
          nodes = [];
          visit.visit(doc, {
            Node: (_key, node) => {
              if (identity.isAlias(node) || identity.hasAnchor(node))
                nodes.push(node);
            }
          });
          if (ctx)
            ctx.aliasResolveCache = nodes;
        }
        let found = void 0;
        for (const node of nodes) {
          if (node === this)
            break;
          if (node.anchor === this.source)
            found = node;
        }
        return found;
      }
      toJSON(_arg, ctx) {
        if (!ctx)
          return { source: this.source };
        const { anchors: anchors2, doc, maxAliasCount } = ctx;
        const source = this.resolve(doc, ctx);
        if (!source) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new ReferenceError(msg);
        }
        let data = anchors2.get(source);
        if (!data) {
          toJS.toJS(source, null, ctx);
          data = anchors2.get(source);
        }
        if (data?.res === void 0) {
          const msg = "This should not happen: Alias anchor was not resolved?";
          throw new ReferenceError(msg);
        }
        if (maxAliasCount >= 0) {
          data.count += 1;
          if (data.aliasCount === 0)
            data.aliasCount = getAliasCount(doc, source, anchors2);
          if (data.count * data.aliasCount > maxAliasCount) {
            const msg = "Excessive alias count indicates a resource exhaustion attack";
            throw new ReferenceError(msg);
          }
        }
        return data.res;
      }
      toString(ctx, _onComment, _onChompKeep) {
        const src = `*${this.source}`;
        if (ctx) {
          anchors.anchorIsValid(this.source);
          if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
            const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
            throw new Error(msg);
          }
          if (ctx.implicitKey)
            return `${src} `;
        }
        return src;
      }
    };
    function getAliasCount(doc, node, anchors2) {
      if (identity.isAlias(node)) {
        const source = node.resolve(doc);
        const anchor = anchors2 && source && anchors2.get(source);
        return anchor ? anchor.count * anchor.aliasCount : 0;
      } else if (identity.isCollection(node)) {
        let count = 0;
        for (const item of node.items) {
          const c = getAliasCount(doc, item, anchors2);
          if (c > count)
            count = c;
        }
        return count;
      } else if (identity.isPair(node)) {
        const kc = getAliasCount(doc, node.key, anchors2);
        const vc = getAliasCount(doc, node.value, anchors2);
        return Math.max(kc, vc);
      }
      return 1;
    }
    exports.Alias = Alias;
  }
});

// node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS({
  "node_modules/yaml/dist/nodes/Scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
    var Scalar = class extends Node.NodeBase {
      constructor(value) {
        super(identity.SCALAR);
        this.value = value;
      }
      toJSON(arg, ctx) {
        return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
      }
      toString() {
        return String(this.value);
      }
    };
    Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
    Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
    Scalar.PLAIN = "PLAIN";
    Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
    Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
    exports.Scalar = Scalar;
    exports.isScalarValue = isScalarValue;
  }
});

// node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS({
  "node_modules/yaml/dist/doc/createNode.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var defaultTagPrefix = "tag:yaml.org,2002:";
    function findTagObject(value, tagName, tags) {
      if (tagName) {
        const match = tags.filter((t2) => t2.tag === tagName);
        const tagObj = match.find((t2) => !t2.format) ?? match[0];
        if (!tagObj)
          throw new Error(`Tag ${tagName} not found`);
        return tagObj;
      }
      return tags.find((t2) => t2.identify?.(value) && !t2.format);
    }
    function createNode(value, tagName, ctx) {
      if (identity.isDocument(value))
        value = value.contents;
      if (identity.isNode(value))
        return value;
      if (identity.isPair(value)) {
        const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
        map.items.push(value);
        return map;
      }
      if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
        value = value.valueOf();
      }
      const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
      let ref = void 0;
      if (aliasDuplicateObjects && value && typeof value === "object") {
        ref = sourceObjects.get(value);
        if (ref) {
          ref.anchor ?? (ref.anchor = onAnchor(value));
          return new Alias.Alias(ref.anchor);
        } else {
          ref = { anchor: null, node: null };
          sourceObjects.set(value, ref);
        }
      }
      if (tagName?.startsWith("!!"))
        tagName = defaultTagPrefix + tagName.slice(2);
      let tagObj = findTagObject(value, tagName, schema.tags);
      if (!tagObj) {
        if (value && typeof value.toJSON === "function") {
          value = value.toJSON();
        }
        if (!value || typeof value !== "object") {
          const node2 = new Scalar.Scalar(value);
          if (ref)
            ref.node = node2;
          return node2;
        }
        tagObj = value instanceof Map ? schema[identity.MAP] : Symbol.iterator in Object(value) ? schema[identity.SEQ] : schema[identity.MAP];
      }
      if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
      }
      const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
      if (tagName)
        node.tag = tagName;
      else if (!tagObj.default)
        node.tag = tagObj.tag;
      if (ref)
        ref.node = node;
      return node;
    }
    exports.createNode = createNode;
  }
});

// node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS({
  "node_modules/yaml/dist/nodes/Collection.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var identity = require_identity();
    var Node = require_Node();
    function collectionFromPath(schema, path, value) {
      let v = value;
      for (let i = path.length - 1; i >= 0; --i) {
        const k2 = path[i];
        if (typeof k2 === "number" && Number.isInteger(k2) && k2 >= 0) {
          const a = [];
          a[k2] = v;
          v = a;
        } else {
          v = /* @__PURE__ */ new Map([[k2, v]]);
        }
      }
      return createNode.createNode(v, void 0, {
        aliasDuplicateObjects: false,
        keepUndefined: false,
        onAnchor: () => {
          throw new Error("This should not happen, please report a bug.");
        },
        schema,
        sourceObjects: /* @__PURE__ */ new Map()
      });
    }
    var isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
    var Collection = class extends Node.NodeBase {
      constructor(type, schema) {
        super(type);
        Object.defineProperty(this, "schema", {
          value: schema,
          configurable: true,
          enumerable: false,
          writable: true
        });
      }
      /**
       * Create a copy of this collection.
       *
       * @param schema - If defined, overwrites the original's schema
       */
      clone(schema) {
        const copy3 = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (schema)
          copy3.schema = schema;
        copy3.items = copy3.items.map((it2) => identity.isNode(it2) || identity.isPair(it2) ? it2.clone(schema) : it2);
        if (this.range)
          copy3.range = this.range.slice();
        return copy3;
      }
      /**
       * Adds a value to the collection. For `!!map` and `!!omap` the value must
       * be a Pair instance or a `{ key, value }` object, which may not have a key
       * that already exists in the map.
       */
      addIn(path, value) {
        if (isEmptyPath(path))
          this.add(value);
        else {
          const [key, ...rest] = path;
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.addIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
      /**
       * Removes a value from the collection.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.delete(key);
        const node = this.get(key, true);
        if (identity.isCollection(node))
          return node.deleteIn(rest);
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        const [key, ...rest] = path;
        const node = this.get(key, true);
        if (rest.length === 0)
          return !keepScalar && identity.isScalar(node) ? node.value : node;
        else
          return identity.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
      }
      hasAllNullValues(allowScalar) {
        return this.items.every((node) => {
          if (!identity.isPair(node))
            return false;
          const n = node.value;
          return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
        });
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       */
      hasIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.has(key);
        const node = this.get(key, true);
        return identity.isCollection(node) ? node.hasIn(rest) : false;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        const [key, ...rest] = path;
        if (rest.length === 0) {
          this.set(key, value);
        } else {
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.setIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
    };
    exports.Collection = Collection;
    exports.collectionFromPath = collectionFromPath;
    exports.isEmptyPath = isEmptyPath;
  }
});

// node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyComment.js"(exports) {
    "use strict";
    var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
    function indentComment(comment, indent) {
      if (/^\n+$/.test(comment))
        return comment.substring(1);
      return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
    }
    var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
    exports.indentComment = indentComment;
    exports.lineComment = lineComment;
    exports.stringifyComment = stringifyComment;
  }
});

// node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS({
  "node_modules/yaml/dist/stringify/foldFlowLines.js"(exports) {
    "use strict";
    var FOLD_FLOW = "flow";
    var FOLD_BLOCK = "block";
    var FOLD_QUOTED = "quoted";
    function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
      if (!lineWidth || lineWidth < 0)
        return text;
      if (lineWidth < minContentWidth)
        minContentWidth = 0;
      const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
      if (text.length <= endStep)
        return text;
      const folds = [];
      const escapedFolds = {};
      let end = lineWidth - indent.length;
      if (typeof indentAtStart === "number") {
        if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
          folds.push(0);
        else
          end = lineWidth - indentAtStart;
      }
      let split = void 0;
      let prev = void 0;
      let overflow = false;
      let i = -1;
      let escStart = -1;
      let escEnd = -1;
      if (mode === FOLD_BLOCK) {
        i = consumeMoreIndentedLines(text, i, indent.length);
        if (i !== -1)
          end = i + endStep;
      }
      for (let ch; ch = text[i += 1]; ) {
        if (mode === FOLD_QUOTED && ch === "\\") {
          escStart = i;
          switch (text[i + 1]) {
            case "x":
              i += 3;
              break;
            case "u":
              i += 5;
              break;
            case "U":
              i += 9;
              break;
            default:
              i += 1;
          }
          escEnd = i;
        }
        if (ch === "\n") {
          if (mode === FOLD_BLOCK)
            i = consumeMoreIndentedLines(text, i, indent.length);
          end = i + indent.length + endStep;
          split = void 0;
        } else {
          if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
            const next = text[i + 1];
            if (next && next !== " " && next !== "\n" && next !== "	")
              split = i;
          }
          if (i >= end) {
            if (split) {
              folds.push(split);
              end = split + endStep;
              split = void 0;
            } else if (mode === FOLD_QUOTED) {
              while (prev === " " || prev === "	") {
                prev = ch;
                ch = text[i += 1];
                overflow = true;
              }
              const j2 = i > escEnd + 1 ? i - 2 : escStart - 1;
              if (escapedFolds[j2])
                return text;
              folds.push(j2);
              escapedFolds[j2] = true;
              end = j2 + endStep;
              split = void 0;
            } else {
              overflow = true;
            }
          }
        }
        prev = ch;
      }
      if (overflow && onOverflow)
        onOverflow();
      if (folds.length === 0)
        return text;
      if (onFold)
        onFold();
      let res = text.slice(0, folds[0]);
      for (let i2 = 0; i2 < folds.length; ++i2) {
        const fold = folds[i2];
        const end2 = folds[i2 + 1] || text.length;
        if (fold === 0)
          res = `
${indent}${text.slice(0, end2)}`;
        else {
          if (mode === FOLD_QUOTED && escapedFolds[fold])
            res += `${text[fold]}\\`;
          res += `
${indent}${text.slice(fold + 1, end2)}`;
        }
      }
      return res;
    }
    function consumeMoreIndentedLines(text, i, indent) {
      let end = i;
      let start = i + 1;
      let ch = text[start];
      while (ch === " " || ch === "	") {
        if (i < start + indent) {
          ch = text[++i];
        } else {
          do {
            ch = text[++i];
          } while (ch && ch !== "\n");
          end = i;
          start = i + 1;
          ch = text[start];
        }
      }
      return end;
    }
    exports.FOLD_BLOCK = FOLD_BLOCK;
    exports.FOLD_FLOW = FOLD_FLOW;
    exports.FOLD_QUOTED = FOLD_QUOTED;
    exports.foldFlowLines = foldFlowLines;
  }
});

// node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyString.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var foldFlowLines = require_foldFlowLines();
    var getFoldOptions = (ctx, isBlock) => ({
      indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
      lineWidth: ctx.options.lineWidth,
      minContentWidth: ctx.options.minContentWidth
    });
    var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
    function lineLengthOverLimit(str, lineWidth, indentLength) {
      if (!lineWidth || lineWidth < 0)
        return false;
      const limit = lineWidth - indentLength;
      const strLen = str.length;
      if (strLen <= limit)
        return false;
      for (let i = 0, start = 0; i < strLen; ++i) {
        if (str[i] === "\n") {
          if (i - start > limit)
            return true;
          start = i + 1;
          if (strLen - start <= limit)
            return false;
        }
      }
      return true;
    }
    function doubleQuotedString(value, ctx) {
      const json = JSON.stringify(value);
      if (ctx.options.doubleQuotedAsJSON)
        return json;
      const { implicitKey } = ctx;
      const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      let str = "";
      let start = 0;
      for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
        if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
          str += json.slice(start, i) + "\\ ";
          i += 1;
          start = i;
          ch = "\\";
        }
        if (ch === "\\")
          switch (json[i + 1]) {
            case "u":
              {
                str += json.slice(start, i);
                const code = json.substr(i + 2, 4);
                switch (code) {
                  case "0000":
                    str += "\\0";
                    break;
                  case "0007":
                    str += "\\a";
                    break;
                  case "000b":
                    str += "\\v";
                    break;
                  case "001b":
                    str += "\\e";
                    break;
                  case "0085":
                    str += "\\N";
                    break;
                  case "00a0":
                    str += "\\_";
                    break;
                  case "2028":
                    str += "\\L";
                    break;
                  case "2029":
                    str += "\\P";
                    break;
                  default:
                    if (code.substr(0, 2) === "00")
                      str += "\\x" + code.substr(2);
                    else
                      str += json.substr(i, 6);
                }
                i += 5;
                start = i + 1;
              }
              break;
            case "n":
              if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
                i += 1;
              } else {
                str += json.slice(start, i) + "\n\n";
                while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                  str += "\n";
                  i += 2;
                }
                str += indent;
                if (json[i + 2] === " ")
                  str += "\\";
                i += 1;
                start = i + 1;
              }
              break;
            default:
              i += 1;
          }
      }
      str = start ? str + json.slice(start) : json;
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
    }
    function singleQuotedString(value, ctx) {
      if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
        return doubleQuotedString(value, ctx);
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
      return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function quotedString(value, ctx) {
      const { singleQuote } = ctx.options;
      let qs;
      if (singleQuote === false)
        qs = doubleQuotedString;
      else {
        const hasDouble = value.includes('"');
        const hasSingle = value.includes("'");
        if (hasDouble && !hasSingle)
          qs = singleQuotedString;
        else if (hasSingle && !hasDouble)
          qs = doubleQuotedString;
        else
          qs = singleQuote ? singleQuotedString : doubleQuotedString;
      }
      return qs(value, ctx);
    }
    var blockEndNewlines;
    try {
      blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
    } catch {
      blockEndNewlines = /\n+(?!\n|$)/g;
    }
    function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
      const { blockQuote, commentString, lineWidth } = ctx.options;
      if (!blockQuote || /\n[\t ]+$/.test(value)) {
        return quotedString(value, ctx);
      }
      const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
      const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
      if (!value)
        return literal ? "|\n" : ">\n";
      let chomp;
      let endStart;
      for (endStart = value.length; endStart > 0; --endStart) {
        const ch = value[endStart - 1];
        if (ch !== "\n" && ch !== "	" && ch !== " ")
          break;
      }
      let end = value.substring(endStart);
      const endNlPos = end.indexOf("\n");
      if (endNlPos === -1) {
        chomp = "-";
      } else if (value === end || endNlPos !== end.length - 1) {
        chomp = "+";
        if (onChompKeep)
          onChompKeep();
      } else {
        chomp = "";
      }
      if (end) {
        value = value.slice(0, -end.length);
        if (end[end.length - 1] === "\n")
          end = end.slice(0, -1);
        end = end.replace(blockEndNewlines, `$&${indent}`);
      }
      let startWithSpace = false;
      let startEnd;
      let startNlPos = -1;
      for (startEnd = 0; startEnd < value.length; ++startEnd) {
        const ch = value[startEnd];
        if (ch === " ")
          startWithSpace = true;
        else if (ch === "\n")
          startNlPos = startEnd;
        else
          break;
      }
      let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
      if (start) {
        value = value.substring(start.length);
        start = start.replace(/\n+/g, `$&${indent}`);
      }
      const indentSize = indent ? "2" : "1";
      let header = (startWithSpace ? indentSize : "") + chomp;
      if (comment) {
        header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
        if (onComment)
          onComment();
      }
      if (!literal) {
        const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
        let literalFallback = false;
        const foldOptions = getFoldOptions(ctx, true);
        if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) {
          foldOptions.onOverflow = () => {
            literalFallback = true;
          };
        }
        const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
        if (!literalFallback)
          return `>${header}
${indent}${body}`;
      }
      value = value.replace(/\n+/g, `$&${indent}`);
      return `|${header}
${indent}${start}${value}${end}`;
    }
    function plainString(item, ctx, onComment, onChompKeep) {
      const { type, value } = item;
      const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
      if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
        return quotedString(value, ctx);
      }
      if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
        return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
      }
      if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes("\n")) {
        return blockString(item, ctx, onComment, onChompKeep);
      }
      if (containsDocumentMarker(value)) {
        if (indent === "") {
          ctx.forceBlockIndent = true;
          return blockString(item, ctx, onComment, onChompKeep);
        } else if (implicitKey && indent === indentStep) {
          return quotedString(value, ctx);
        }
      }
      const str = value.replace(/\n+/g, `$&
${indent}`);
      if (actualString) {
        const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test))
          return quotedString(value, ctx);
      }
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function stringifyString(item, ctx, onComment, onChompKeep) {
      const { implicitKey, inFlow } = ctx;
      const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
      let { type } = item;
      if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
          type = Scalar.Scalar.QUOTE_DOUBLE;
      }
      const _stringify = (_type) => {
        switch (_type) {
          case Scalar.Scalar.BLOCK_FOLDED:
          case Scalar.Scalar.BLOCK_LITERAL:
            return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
          case Scalar.Scalar.QUOTE_DOUBLE:
            return doubleQuotedString(ss.value, ctx);
          case Scalar.Scalar.QUOTE_SINGLE:
            return singleQuotedString(ss.value, ctx);
          case Scalar.Scalar.PLAIN:
            return plainString(ss, ctx, onComment, onChompKeep);
          default:
            return null;
        }
      };
      let res = _stringify(type);
      if (res === null) {
        const { defaultKeyType, defaultStringType } = ctx.options;
        const t2 = implicitKey && defaultKeyType || defaultStringType;
        res = _stringify(t2);
        if (res === null)
          throw new Error(`Unsupported default string type ${t2}`);
      }
      return res;
    }
    exports.stringifyString = stringifyString;
  }
});

// node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS({
  "node_modules/yaml/dist/stringify/stringify.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var identity = require_identity();
    var stringifyComment = require_stringifyComment();
    var stringifyString = require_stringifyString();
    function createStringifyContext(doc, options) {
      const opt = Object.assign({
        blockQuote: true,
        commentString: stringifyComment.stringifyComment,
        defaultKeyType: null,
        defaultStringType: "PLAIN",
        directives: null,
        doubleQuotedAsJSON: false,
        doubleQuotedMinMultiLineLength: 40,
        falseStr: "false",
        flowCollectionPadding: true,
        indentSeq: true,
        lineWidth: 80,
        minContentWidth: 20,
        nullStr: "null",
        simpleKeys: false,
        singleQuote: null,
        trailingComma: false,
        trueStr: "true",
        verifyAliasOrder: true
      }, doc.schema.toStringOptions, options);
      let inFlow;
      switch (opt.collectionStyle) {
        case "block":
          inFlow = false;
          break;
        case "flow":
          inFlow = true;
          break;
        default:
          inFlow = null;
      }
      return {
        anchors: /* @__PURE__ */ new Set(),
        doc,
        flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
        indent: "",
        indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
        inFlow,
        options: opt
      };
    }
    function getTagObject(tags, item) {
      if (item.tag) {
        const match = tags.filter((t2) => t2.tag === item.tag);
        if (match.length > 0)
          return match.find((t2) => t2.format === item.format) ?? match[0];
      }
      let tagObj = void 0;
      let obj;
      if (identity.isScalar(item)) {
        obj = item.value;
        let match = tags.filter((t2) => t2.identify?.(obj));
        if (match.length > 1) {
          const testMatch = match.filter((t2) => t2.test);
          if (testMatch.length > 0)
            match = testMatch;
        }
        tagObj = match.find((t2) => t2.format === item.format) ?? match.find((t2) => !t2.format);
      } else {
        obj = item;
        tagObj = tags.find((t2) => t2.nodeClass && obj instanceof t2.nodeClass);
      }
      if (!tagObj) {
        const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
        throw new Error(`Tag not resolved for ${name} value`);
      }
      return tagObj;
    }
    function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
      if (!doc.directives)
        return "";
      const props = [];
      const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
      if (anchor && anchors.anchorIsValid(anchor)) {
        anchors$1.add(anchor);
        props.push(`&${anchor}`);
      }
      const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
      if (tag)
        props.push(doc.directives.tagString(tag));
      return props.join(" ");
    }
    function stringify2(item, ctx, onComment, onChompKeep) {
      if (identity.isPair(item))
        return item.toString(ctx, onComment, onChompKeep);
      if (identity.isAlias(item)) {
        if (ctx.doc.directives)
          return item.toString(ctx);
        if (ctx.resolvedAliases?.has(item)) {
          throw new TypeError(`Cannot stringify circular structure without alias nodes`);
        } else {
          if (ctx.resolvedAliases)
            ctx.resolvedAliases.add(item);
          else
            ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
          item = item.resolve(ctx.doc);
        }
      }
      let tagObj = void 0;
      const node = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
      tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
      const props = stringifyProps(node, tagObj, ctx);
      if (props.length > 0)
        ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
      const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
      if (!props)
        return str;
      return identity.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
    }
    exports.createStringifyContext = createStringifyContext;
    exports.stringify = stringify2;
  }
});

// node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyPair.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var stringify2 = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
      const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
      let keyComment = identity.isNode(key) && key.comment || null;
      if (simpleKeys) {
        if (keyComment) {
          throw new Error("With simple keys, key nodes cannot have comments");
        }
        if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") {
          const msg = "With simple keys, collection cannot be used as a key value";
          throw new Error(msg);
        }
      }
      let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
      ctx = Object.assign({}, ctx, {
        allNullValues: false,
        implicitKey: !explicitKey && (simpleKeys || !allNullValues),
        indent: indent + indentStep
      });
      let keyCommentDone = false;
      let chompKeep = false;
      let str = stringify2.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
      if (!explicitKey && !ctx.inFlow && str.length > 1024) {
        if (simpleKeys)
          throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
        explicitKey = true;
      }
      if (ctx.inFlow) {
        if (allNullValues || value == null) {
          if (keyCommentDone && onComment)
            onComment();
          return str === "" ? "?" : explicitKey ? `? ${str}` : str;
        }
      } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
        str = `? ${str}`;
        if (keyComment && !keyCommentDone) {
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        } else if (chompKeep && onChompKeep)
          onChompKeep();
        return str;
      }
      if (keyCommentDone)
        keyComment = null;
      if (explicitKey) {
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        str = `? ${str}
${indent}:`;
      } else {
        str = `${str}:`;
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      }
      let vsb, vcb, valueComment;
      if (identity.isNode(value)) {
        vsb = !!value.spaceBefore;
        vcb = value.commentBefore;
        valueComment = value.comment;
      } else {
        vsb = false;
        vcb = null;
        valueComment = null;
        if (value && typeof value === "object")
          value = doc.createNode(value);
      }
      ctx.implicitKey = false;
      if (!explicitKey && !keyComment && identity.isScalar(value))
        ctx.indentAtStart = str.length + 1;
      chompKeep = false;
      if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) {
        ctx.indent = ctx.indent.substring(2);
      }
      let valueCommentDone = false;
      const valueStr = stringify2.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
      let ws = " ";
      if (keyComment || vsb || vcb) {
        ws = vsb ? "\n" : "";
        if (vcb) {
          const cs = commentString(vcb);
          ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
        }
        if (valueStr === "" && !ctx.inFlow) {
          if (ws === "\n" && valueComment)
            ws = "\n\n";
        } else {
          ws += `
${ctx.indent}`;
        }
      } else if (!explicitKey && identity.isCollection(value)) {
        const vs0 = valueStr[0];
        const nl0 = valueStr.indexOf("\n");
        const hasNewline = nl0 !== -1;
        const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
        if (hasNewline || !flow) {
          let hasPropsLine = false;
          if (hasNewline && (vs0 === "&" || vs0 === "!")) {
            let sp0 = valueStr.indexOf(" ");
            if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
              sp0 = valueStr.indexOf(" ", sp0 + 1);
            }
            if (sp0 === -1 || nl0 < sp0)
              hasPropsLine = true;
          }
          if (!hasPropsLine)
            ws = `
${ctx.indent}`;
        }
      } else if (valueStr === "" || valueStr[0] === "\n") {
        ws = "";
      }
      str += ws + valueStr;
      if (ctx.inFlow) {
        if (valueCommentDone && onComment)
          onComment();
      } else if (valueComment && !valueCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
      } else if (chompKeep && onChompKeep) {
        onChompKeep();
      }
      return str;
    }
    exports.stringifyPair = stringifyPair;
  }
});

// node_modules/yaml/dist/log.js
var require_log = __commonJS({
  "node_modules/yaml/dist/log.js"(exports) {
    "use strict";
    var node_process = __require("process");
    function debug(logLevel, ...messages) {
      if (logLevel === "debug")
        console.log(...messages);
    }
    function warn(logLevel, warning) {
      if (logLevel === "debug" || logLevel === "warn") {
        if (typeof node_process.emitWarning === "function")
          node_process.emitWarning(warning);
        else
          console.warn(warning);
      }
    }
    exports.debug = debug;
    exports.warn = warn;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/merge.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var MERGE_KEY = "<<";
    var merge2 = {
      identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
      default: "key",
      tag: "tag:yaml.org,2002:merge",
      test: /^<<$/,
      resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
        addToJSMap: addMergeToJSMap
      }),
      stringify: () => MERGE_KEY
    };
    var isMergeKey = (ctx, key) => (merge2.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge2.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge2.tag && tag.default);
    function addMergeToJSMap(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (identity.isSeq(source))
        for (const it2 of source.items)
          mergeValue(ctx, map, it2);
      else if (Array.isArray(source))
        for (const it2 of source)
          mergeValue(ctx, map, it2);
      else
        mergeValue(ctx, map, source);
    }
    function mergeValue(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (!identity.isMap(source))
        throw new Error("Merge sources must be maps or map aliases");
      const srcMap = source.toJSON(null, ctx, Map);
      for (const [key, value2] of srcMap) {
        if (map instanceof Map) {
          if (!map.has(key))
            map.set(key, value2);
        } else if (map instanceof Set) {
          map.add(key);
        } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
          Object.defineProperty(map, key, {
            value: value2,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      }
      return map;
    }
    function resolveAliasValue(ctx, value) {
      return ctx && identity.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
    }
    exports.addMergeToJSMap = addMergeToJSMap;
    exports.isMergeKey = isMergeKey;
    exports.merge = merge2;
  }
});

// node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS({
  "node_modules/yaml/dist/nodes/addPairToJSMap.js"(exports) {
    "use strict";
    var log = require_log();
    var merge2 = require_merge();
    var stringify2 = require_stringify();
    var identity = require_identity();
    var toJS = require_toJS();
    function addPairToJSMap(ctx, map, { key, value }) {
      if (identity.isNode(key) && key.addToJSMap)
        key.addToJSMap(ctx, map, value);
      else if (merge2.isMergeKey(ctx, key))
        merge2.addMergeToJSMap(ctx, map, value);
      else {
        const jsKey = toJS.toJS(key, "", ctx);
        if (map instanceof Map) {
          map.set(jsKey, toJS.toJS(value, jsKey, ctx));
        } else if (map instanceof Set) {
          map.add(jsKey);
        } else {
          const stringKey = stringifyKey(key, jsKey, ctx);
          const jsValue = toJS.toJS(value, stringKey, ctx);
          if (stringKey in map)
            Object.defineProperty(map, stringKey, {
              value: jsValue,
              writable: true,
              enumerable: true,
              configurable: true
            });
          else
            map[stringKey] = jsValue;
        }
      }
      return map;
    }
    function stringifyKey(key, jsKey, ctx) {
      if (jsKey === null)
        return "";
      if (typeof jsKey !== "object")
        return String(jsKey);
      if (identity.isNode(key) && ctx?.doc) {
        const strCtx = stringify2.createStringifyContext(ctx.doc, {});
        strCtx.anchors = /* @__PURE__ */ new Set();
        for (const node of ctx.anchors.keys())
          strCtx.anchors.add(node.anchor);
        strCtx.inFlow = true;
        strCtx.inStringifyKey = true;
        const strKey = key.toString(strCtx);
        if (!ctx.mapKeyWarned) {
          let jsonStr = JSON.stringify(strKey);
          if (jsonStr.length > 40)
            jsonStr = jsonStr.substring(0, 36) + '..."';
          log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
          ctx.mapKeyWarned = true;
        }
        return strKey;
      }
      return JSON.stringify(jsKey);
    }
    exports.addPairToJSMap = addPairToJSMap;
  }
});

// node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS({
  "node_modules/yaml/dist/nodes/Pair.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyPair = require_stringifyPair();
    var addPairToJSMap = require_addPairToJSMap();
    var identity = require_identity();
    function createPair(key, value, ctx) {
      const k2 = createNode.createNode(key, void 0, ctx);
      const v = createNode.createNode(value, void 0, ctx);
      return new Pair(k2, v);
    }
    var Pair = class _Pair {
      constructor(key, value = null) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
        this.key = key;
        this.value = value;
      }
      clone(schema) {
        let { key, value } = this;
        if (identity.isNode(key))
          key = key.clone(schema);
        if (identity.isNode(value))
          value = value.clone(schema);
        return new _Pair(key, value);
      }
      toJSON(_2, ctx) {
        const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        return addPairToJSMap.addPairToJSMap(ctx, pair, this);
      }
      toString(ctx, onComment, onChompKeep) {
        return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
      }
    };
    exports.Pair = Pair;
    exports.createPair = createPair;
  }
});

// node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyCollection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify2 = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyCollection(collection, ctx, options) {
      const flow = ctx.inFlow ?? collection.flow;
      const stringify3 = flow ? stringifyFlowCollection : stringifyBlockCollection;
      return stringify3(collection, ctx, options);
    }
    function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
      const { indent, options: { commentString } } = ctx;
      const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
      let chompKeep = false;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment2 = null;
        if (identity.isNode(item)) {
          if (!chompKeep && item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
          if (item.comment)
            comment2 = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (!chompKeep && ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
          }
        }
        chompKeep = false;
        let str2 = stringify2.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
        if (comment2)
          str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment2));
        if (chompKeep && comment2)
          chompKeep = false;
        lines.push(blockItemPrefix + str2);
      }
      let str;
      if (lines.length === 0) {
        str = flowChars.start + flowChars.end;
      } else {
        str = lines[0];
        for (let i = 1; i < lines.length; ++i) {
          const line = lines[i];
          str += line ? `
${indent}${line}` : "\n";
        }
      }
      if (comment) {
        str += "\n" + stringifyComment.indentComment(commentString(comment), indent);
        if (onComment)
          onComment();
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
      const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
      itemIndent += indentStep;
      const itemCtx = Object.assign({}, ctx, {
        indent: itemIndent,
        inFlow: true,
        type: null
      });
      let reqNewline = false;
      let linesAtValue = 0;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment = null;
        if (identity.isNode(item)) {
          if (item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, false);
          if (item.comment)
            comment = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, false);
            if (ik.comment)
              reqNewline = true;
          }
          const iv = identity.isNode(item.value) ? item.value : null;
          if (iv) {
            if (iv.comment)
              comment = iv.comment;
            if (iv.commentBefore)
              reqNewline = true;
          } else if (item.value == null && ik?.comment) {
            comment = ik.comment;
          }
        }
        if (comment)
          reqNewline = true;
        let str = stringify2.stringify(item, itemCtx, () => comment = null);
        reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
        if (i < items.length - 1) {
          str += ",";
        } else if (ctx.options.trailingComma) {
          if (ctx.options.lineWidth > 0) {
            reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
          }
          if (reqNewline) {
            str += ",";
          }
        }
        if (comment)
          str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
        lines.push(str);
        linesAtValue = lines.length;
      }
      const { start, end } = flowChars;
      if (lines.length === 0) {
        return start + end;
      } else {
        if (!reqNewline) {
          const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
          reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
        }
        if (reqNewline) {
          let str = start;
          for (const line of lines)
            str += line ? `
${indentStep}${indent}${line}` : "\n";
          return `${str}
${indent}${end}`;
        } else {
          return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
        }
      }
    }
    function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
      if (comment && chompKeep)
        comment = comment.replace(/^\n+/, "");
      if (comment) {
        const ic = stringifyComment.indentComment(commentString(comment), indent);
        lines.push(ic.trimStart());
      }
    }
    exports.stringifyCollection = stringifyCollection;
  }
});

// node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS({
  "node_modules/yaml/dist/nodes/YAMLMap.js"(exports) {
    "use strict";
    var stringifyCollection = require_stringifyCollection();
    var addPairToJSMap = require_addPairToJSMap();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    function findPair(items, key) {
      const k2 = identity.isScalar(key) ? key.value : key;
      for (const it2 of items) {
        if (identity.isPair(it2)) {
          if (it2.key === key || it2.key === k2)
            return it2;
          if (identity.isScalar(it2.key) && it2.key.value === k2)
            return it2;
        }
      }
      return void 0;
    }
    var YAMLMap = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:map";
      }
      constructor(schema) {
        super(identity.MAP, schema);
        this.items = [];
      }
      /**
       * A generic collection parsing method that can be extended
       * to other node classes that inherit from YAMLMap
       */
      static from(schema, obj, ctx) {
        const { keepUndefined, replacer } = ctx;
        const map = new this(schema);
        const add = (key, value) => {
          if (typeof replacer === "function")
            value = replacer.call(obj, key, value);
          else if (Array.isArray(replacer) && !replacer.includes(key))
            return;
          if (value !== void 0 || keepUndefined)
            map.items.push(Pair.createPair(key, value, ctx));
        };
        if (obj instanceof Map) {
          for (const [key, value] of obj)
            add(key, value);
        } else if (obj && typeof obj === "object") {
          for (const key of Object.keys(obj))
            add(key, obj[key]);
        }
        if (typeof schema.sortMapEntries === "function") {
          map.items.sort(schema.sortMapEntries);
        }
        return map;
      }
      /**
       * Adds a value to the collection.
       *
       * @param overwrite - If not set `true`, using a key that is already in the
       *   collection will throw. Otherwise, overwrites the previous value.
       */
      add(pair, overwrite) {
        let _pair;
        if (identity.isPair(pair))
          _pair = pair;
        else if (!pair || typeof pair !== "object" || !("key" in pair)) {
          _pair = new Pair.Pair(pair, pair?.value);
        } else
          _pair = new Pair.Pair(pair.key, pair.value);
        const prev = findPair(this.items, _pair.key);
        const sortEntries = this.schema?.sortMapEntries;
        if (prev) {
          if (!overwrite)
            throw new Error(`Key ${_pair.key} already set`);
          if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
            prev.value.value = _pair.value;
          else
            prev.value = _pair.value;
        } else if (sortEntries) {
          const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
          if (i === -1)
            this.items.push(_pair);
          else
            this.items.splice(i, 0, _pair);
        } else {
          this.items.push(_pair);
        }
      }
      delete(key) {
        const it2 = findPair(this.items, key);
        if (!it2)
          return false;
        const del = this.items.splice(this.items.indexOf(it2), 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const it2 = findPair(this.items, key);
        const node = it2?.value;
        return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? void 0;
      }
      has(key) {
        return !!findPair(this.items, key);
      }
      set(key, value) {
        this.add(new Pair.Pair(key, value), true);
      }
      /**
       * @param ctx - Conversion context, originally set in Document#toJS()
       * @param {Class} Type - If set, forces the returned collection type
       * @returns Instance of Type, Map, or Object
       */
      toJSON(_2, ctx, Type) {
        const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const item of this.items)
          addPairToJSMap.addPairToJSMap(ctx, map, item);
        return map;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        for (const item of this.items) {
          if (!identity.isPair(item))
            throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
        }
        if (!ctx.allNullValues && this.hasAllNullValues(false))
          ctx = Object.assign({}, ctx, { allNullValues: true });
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "",
          flowChars: { start: "{", end: "}" },
          itemIndent: ctx.indent || "",
          onChompKeep,
          onComment
        });
      }
    };
    exports.YAMLMap = YAMLMap;
    exports.findPair = findPair;
  }
});

// node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS({
  "node_modules/yaml/dist/schema/common/map.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLMap = require_YAMLMap();
    var map = {
      collection: "map",
      default: true,
      nodeClass: YAMLMap.YAMLMap,
      tag: "tag:yaml.org,2002:map",
      resolve(map2, onError) {
        if (!identity.isMap(map2))
          onError("Expected a mapping for this tag");
        return map2;
      },
      createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
    };
    exports.map = map;
  }
});

// node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS({
  "node_modules/yaml/dist/nodes/YAMLSeq.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyCollection = require_stringifyCollection();
    var Collection = require_Collection();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var toJS = require_toJS();
    var YAMLSeq = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:seq";
      }
      constructor(schema) {
        super(identity.SEQ, schema);
        this.items = [];
      }
      add(value) {
        this.items.push(value);
      }
      /**
       * Removes a value from the collection.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       *
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return false;
        const del = this.items.splice(idx, 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return void 0;
        const it2 = this.items[idx];
        return !keepScalar && identity.isScalar(it2) ? it2.value : it2;
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       */
      has(key) {
        const idx = asItemIndex(key);
        return typeof idx === "number" && idx < this.items.length;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       *
       * If `key` does not contain a representation of an integer, this will throw.
       * It may be wrapped in a `Scalar`.
       */
      set(key, value) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          throw new Error(`Expected a valid index, not ${key}.`);
        const prev = this.items[idx];
        if (identity.isScalar(prev) && Scalar.isScalarValue(value))
          prev.value = value;
        else
          this.items[idx] = value;
      }
      toJSON(_2, ctx) {
        const seq = [];
        if (ctx?.onCreate)
          ctx.onCreate(seq);
        let i = 0;
        for (const item of this.items)
          seq.push(toJS.toJS(item, String(i++), ctx));
        return seq;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "- ",
          flowChars: { start: "[", end: "]" },
          itemIndent: (ctx.indent || "") + "  ",
          onChompKeep,
          onComment
        });
      }
      static from(schema, obj, ctx) {
        const { replacer } = ctx;
        const seq = new this(schema);
        if (obj && Symbol.iterator in Object(obj)) {
          let i = 0;
          for (let it2 of obj) {
            if (typeof replacer === "function") {
              const key = obj instanceof Set ? it2 : String(i++);
              it2 = replacer.call(obj, key, it2);
            }
            seq.items.push(createNode.createNode(it2, void 0, ctx));
          }
        }
        return seq;
      }
    };
    function asItemIndex(key) {
      let idx = identity.isScalar(key) ? key.value : key;
      if (idx && typeof idx === "string")
        idx = Number(idx);
      return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
    }
    exports.YAMLSeq = YAMLSeq;
  }
});

// node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS({
  "node_modules/yaml/dist/schema/common/seq.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLSeq = require_YAMLSeq();
    var seq = {
      collection: "seq",
      default: true,
      nodeClass: YAMLSeq.YAMLSeq,
      tag: "tag:yaml.org,2002:seq",
      resolve(seq2, onError) {
        if (!identity.isSeq(seq2))
          onError("Expected a sequence for this tag");
        return seq2;
      },
      createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
    };
    exports.seq = seq;
  }
});

// node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS({
  "node_modules/yaml/dist/schema/common/string.js"(exports) {
    "use strict";
    var stringifyString = require_stringifyString();
    var string = {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify(item, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
      }
    };
    exports.string = string;
  }
});

// node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS({
  "node_modules/yaml/dist/schema/common/null.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var nullTag = {
      identify: (value) => value == null,
      createNode: () => new Scalar.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^(?:~|[Nn]ull|NULL)?$/,
      resolve: () => new Scalar.Scalar(null),
      stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
    };
    exports.nullTag = nullTag;
  }
});

// node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS({
  "node_modules/yaml/dist/schema/core/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var boolTag = {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
      resolve: (str) => new Scalar.Scalar(str[0] === "t" || str[0] === "T"),
      stringify({ source, value }, ctx) {
        if (source && boolTag.test.test(source)) {
          const sv = source[0] === "t" || source[0] === "T";
          if (value === sv)
            return source;
        }
        return value ? ctx.options.trueStr : ctx.options.falseStr;
      }
    };
    exports.boolTag = boolTag;
  }
});

// node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyNumber.js"(exports) {
    "use strict";
    function stringifyNumber({ format, minFractionDigits, tag, value }) {
      if (typeof value === "bigint")
        return String(value);
      const num = typeof value === "number" ? value : Number(value);
      if (!isFinite(num))
        return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
      let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
      if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
        let i = n.indexOf(".");
        if (i < 0) {
          i = n.length;
          n += ".";
        }
        let d = minFractionDigits - (n.length - i - 1);
        while (d-- > 0)
          n += "0";
      }
      return n;
    }
    exports.stringifyNumber = stringifyNumber;
  }
});

// node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS({
  "node_modules/yaml/dist/schema/core/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str));
        const dot = str.indexOf(".");
        if (dot !== -1 && str[str.length - 1] === "0")
          node.minFractionDigits = str.length - dot - 1;
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS({
  "node_modules/yaml/dist/schema/core/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value) && value >= 0)
        return prefix + value.toString(radix);
      return stringifyNumber.stringifyNumber(node);
    }
    var intOct = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^0o[0-7]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
      stringify: (node) => intStringify(node, 8, "0o")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^0x[0-9a-fA-F]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/core/schema.js
var require_schema2 = __commonJS({
  "node_modules/yaml/dist/schema/core/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.boolTag,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float
    ];
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/json/schema.js
var require_schema3 = __commonJS({
  "node_modules/yaml/dist/schema/json/schema.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var map = require_map();
    var seq = require_seq();
    function intIdentify(value) {
      return typeof value === "bigint" || Number.isInteger(value);
    }
    var stringifyJSON = ({ value }) => JSON.stringify(value);
    var jsonScalars = [
      {
        identify: (value) => typeof value === "string",
        default: true,
        tag: "tag:yaml.org,2002:str",
        resolve: (str) => str,
        stringify: stringifyJSON
      },
      {
        identify: (value) => value == null,
        createNode: () => new Scalar.Scalar(null),
        default: true,
        tag: "tag:yaml.org,2002:null",
        test: /^null$/,
        resolve: () => null,
        stringify: stringifyJSON
      },
      {
        identify: (value) => typeof value === "boolean",
        default: true,
        tag: "tag:yaml.org,2002:bool",
        test: /^true$|^false$/,
        resolve: (str) => str === "true",
        stringify: stringifyJSON
      },
      {
        identify: intIdentify,
        default: true,
        tag: "tag:yaml.org,2002:int",
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
        stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
      },
      {
        identify: (value) => typeof value === "number",
        default: true,
        tag: "tag:yaml.org,2002:float",
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: (str) => parseFloat(str),
        stringify: stringifyJSON
      }
    ];
    var jsonError = {
      default: true,
      tag: "",
      test: /^/,
      resolve(str, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
        return str;
      }
    };
    var schema = [map.map, seq.seq].concat(jsonScalars, jsonError);
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/binary.js"(exports) {
    "use strict";
    var node_buffer = __require("buffer");
    var Scalar = require_Scalar();
    var stringifyString = require_stringifyString();
    var binary = {
      identify: (value) => value instanceof Uint8Array,
      // Buffer inherits from Uint8Array
      default: false,
      tag: "tag:yaml.org,2002:binary",
      /**
       * Returns a Buffer in node and an Uint8Array in browsers
       *
       * To use the resulting buffer as an image, you'll want to do something like:
       *
       *   const blob = new Blob([buffer], { type: 'image/jpeg' })
       *   document.querySelector('#photo').src = URL.createObjectURL(blob)
       */
      resolve(src, onError) {
        if (typeof node_buffer.Buffer === "function") {
          return node_buffer.Buffer.from(src, "base64");
        } else if (typeof atob === "function") {
          const str = atob(src.replace(/[\n\r]/g, ""));
          const buffer = new Uint8Array(str.length);
          for (let i = 0; i < str.length; ++i)
            buffer[i] = str.charCodeAt(i);
          return buffer;
        } else {
          onError("This environment does not support reading binary tags; either Buffer or atob is required");
          return src;
        }
      },
      stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
        if (!value)
          return "";
        const buf = value;
        let str;
        if (typeof node_buffer.Buffer === "function") {
          str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
        } else if (typeof btoa === "function") {
          let s = "";
          for (let i = 0; i < buf.length; ++i)
            s += String.fromCharCode(buf[i]);
          str = btoa(s);
        } else {
          throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
        }
        type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
        if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
          const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
          const n = Math.ceil(str.length / lineWidth);
          const lines = new Array(n);
          for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
            lines[i] = str.substr(o, lineWidth);
          }
          str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? "\n" : " ");
        }
        return stringifyString.stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
      }
    };
    exports.binary = binary;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/pairs.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLSeq = require_YAMLSeq();
    function resolvePairs(seq, onError) {
      if (identity.isSeq(seq)) {
        for (let i = 0; i < seq.items.length; ++i) {
          let item = seq.items[i];
          if (identity.isPair(item))
            continue;
          else if (identity.isMap(item)) {
            if (item.items.length > 1)
              onError("Each pair must have its own sequence indicator");
            const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
            if (item.commentBefore)
              pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
            if (item.comment) {
              const cn = pair.value ?? pair.key;
              cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
            }
            item = pair;
          }
          seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
        }
      } else
        onError("Expected a sequence for this tag");
      return seq;
    }
    function createPairs(schema, iterable, ctx) {
      const { replacer } = ctx;
      const pairs2 = new YAMLSeq.YAMLSeq(schema);
      pairs2.tag = "tag:yaml.org,2002:pairs";
      let i = 0;
      if (iterable && Symbol.iterator in Object(iterable))
        for (let it2 of iterable) {
          if (typeof replacer === "function")
            it2 = replacer.call(iterable, String(i++), it2);
          let key, value;
          if (Array.isArray(it2)) {
            if (it2.length === 2) {
              key = it2[0];
              value = it2[1];
            } else
              throw new TypeError(`Expected [key, value] tuple: ${it2}`);
          } else if (it2 && it2 instanceof Object) {
            const keys = Object.keys(it2);
            if (keys.length === 1) {
              key = keys[0];
              value = it2[key];
            } else {
              throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
            }
          } else {
            key = it2;
          }
          pairs2.items.push(Pair.createPair(key, value, ctx));
        }
      return pairs2;
    }
    var pairs = {
      collection: "seq",
      default: false,
      tag: "tag:yaml.org,2002:pairs",
      resolve: resolvePairs,
      createNode: createPairs
    };
    exports.createPairs = createPairs;
    exports.pairs = pairs;
    exports.resolvePairs = resolvePairs;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/omap.js"(exports) {
    "use strict";
    var identity = require_identity();
    var toJS = require_toJS();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var pairs = require_pairs();
    var YAMLOMap = class _YAMLOMap extends YAMLSeq.YAMLSeq {
      constructor() {
        super();
        this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
        this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
        this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
        this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
        this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
        this.tag = _YAMLOMap.tag;
      }
      /**
       * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
       * but TypeScript won't allow widening the signature of a child method.
       */
      toJSON(_2, ctx) {
        if (!ctx)
          return super.toJSON(_2);
        const map = /* @__PURE__ */ new Map();
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const pair of this.items) {
          let key, value;
          if (identity.isPair(pair)) {
            key = toJS.toJS(pair.key, "", ctx);
            value = toJS.toJS(pair.value, key, ctx);
          } else {
            key = toJS.toJS(pair, "", ctx);
          }
          if (map.has(key))
            throw new Error("Ordered maps must not include duplicate keys");
          map.set(key, value);
        }
        return map;
      }
      static from(schema, iterable, ctx) {
        const pairs$1 = pairs.createPairs(schema, iterable, ctx);
        const omap2 = new this();
        omap2.items = pairs$1.items;
        return omap2;
      }
    };
    YAMLOMap.tag = "tag:yaml.org,2002:omap";
    var omap = {
      collection: "seq",
      identify: (value) => value instanceof Map,
      nodeClass: YAMLOMap,
      default: false,
      tag: "tag:yaml.org,2002:omap",
      resolve(seq, onError) {
        const pairs$1 = pairs.resolvePairs(seq, onError);
        const seenKeys = [];
        for (const { key } of pairs$1.items) {
          if (identity.isScalar(key)) {
            if (seenKeys.includes(key.value)) {
              onError(`Ordered maps must not include duplicate keys: ${key.value}`);
            } else {
              seenKeys.push(key.value);
            }
          }
        }
        return Object.assign(new YAMLOMap(), pairs$1);
      },
      createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
    };
    exports.YAMLOMap = YAMLOMap;
    exports.omap = omap;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function boolStringify({ value, source }, ctx) {
      const boolObj = value ? trueTag : falseTag;
      if (source && boolObj.test.test(source))
        return source;
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
    var trueTag = {
      identify: (value) => value === true,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
      resolve: () => new Scalar.Scalar(true),
      stringify: boolStringify
    };
    var falseTag = {
      identify: (value) => value === false,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
      resolve: () => new Scalar.Scalar(false),
      stringify: boolStringify
    };
    exports.falseTag = falseTag;
    exports.trueTag = trueTag;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str.replace(/_/g, "")),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, "")));
        const dot = str.indexOf(".");
        if (dot !== -1) {
          const f = str.substring(dot + 1).replace(/_/g, "");
          if (f[f.length - 1] === "0")
            node.minFractionDigits = f.length;
        }
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    function intResolve(str, offset, radix, { intAsBigInt }) {
      const sign = str[0];
      if (sign === "-" || sign === "+")
        offset += 1;
      str = str.substring(offset).replace(/_/g, "");
      if (intAsBigInt) {
        switch (radix) {
          case 2:
            str = `0b${str}`;
            break;
          case 8:
            str = `0o${str}`;
            break;
          case 16:
            str = `0x${str}`;
            break;
        }
        const n2 = BigInt(str);
        return sign === "-" ? BigInt(-1) * n2 : n2;
      }
      const n = parseInt(str, radix);
      return sign === "-" ? -1 * n : n;
    }
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value)) {
        const str = value.toString(radix);
        return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
      }
      return stringifyNumber.stringifyNumber(node);
    }
    var intBin = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "BIN",
      test: /^[-+]?0b[0-1_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
      stringify: (node) => intStringify(node, 2, "0b")
    };
    var intOct = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^[-+]?0[0-7_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
      stringify: (node) => intStringify(node, 8, "0")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9][0-9_]*$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^[-+]?0x[0-9a-fA-F_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intBin = intBin;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/set.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSet = class _YAMLSet extends YAMLMap.YAMLMap {
      constructor(schema) {
        super(schema);
        this.tag = _YAMLSet.tag;
      }
      add(key) {
        let pair;
        if (identity.isPair(key))
          pair = key;
        else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
          pair = new Pair.Pair(key.key, null);
        else
          pair = new Pair.Pair(key, null);
        const prev = YAMLMap.findPair(this.items, pair.key);
        if (!prev)
          this.items.push(pair);
      }
      /**
       * If `keepPair` is `true`, returns the Pair matching `key`.
       * Otherwise, returns the value of that Pair's key.
       */
      get(key, keepPair) {
        const pair = YAMLMap.findPair(this.items, key);
        return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
      }
      set(key, value) {
        if (typeof value !== "boolean")
          throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
        const prev = YAMLMap.findPair(this.items, key);
        if (prev && !value) {
          this.items.splice(this.items.indexOf(prev), 1);
        } else if (!prev && value) {
          this.items.push(new Pair.Pair(key));
        }
      }
      toJSON(_2, ctx) {
        return super.toJSON(_2, ctx, Set);
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        if (this.hasAllNullValues(true))
          return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
        else
          throw new Error("Set items must all have null values");
      }
      static from(schema, iterable, ctx) {
        const { replacer } = ctx;
        const set2 = new this(schema);
        if (iterable && Symbol.iterator in Object(iterable))
          for (let value of iterable) {
            if (typeof replacer === "function")
              value = replacer.call(iterable, value, value);
            set2.items.push(Pair.createPair(value, null, ctx));
          }
        return set2;
      }
    };
    YAMLSet.tag = "tag:yaml.org,2002:set";
    var set = {
      collection: "map",
      identify: (value) => value instanceof Set,
      nodeClass: YAMLSet,
      default: false,
      tag: "tag:yaml.org,2002:set",
      createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
      resolve(map, onError) {
        if (identity.isMap(map)) {
          if (map.hasAllNullValues(true))
            return Object.assign(new YAMLSet(), map);
          else
            onError("Set items must all have null values");
        } else
          onError("Expected a mapping for this tag");
        return map;
      }
    };
    exports.YAMLSet = YAMLSet;
    exports.set = set;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/timestamp.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    function parseSexagesimal(str, asBigInt) {
      const sign = str[0];
      const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
      const num = (n) => asBigInt ? BigInt(n) : Number(n);
      const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
      return sign === "-" ? num(-1) * res : res;
    }
    function stringifySexagesimal(node) {
      let { value } = node;
      let num = (n) => n;
      if (typeof value === "bigint")
        num = (n) => BigInt(n);
      else if (isNaN(value) || !isFinite(value))
        return stringifyNumber.stringifyNumber(node);
      let sign = "";
      if (value < 0) {
        sign = "-";
        value *= num(-1);
      }
      const _60 = num(60);
      const parts = [value % _60];
      if (value < 60) {
        parts.unshift(0);
      } else {
        value = (value - parts[0]) / _60;
        parts.unshift(value % _60);
        if (value >= 60) {
          value = (value - parts[0]) / _60;
          parts.unshift(value);
        }
      }
      return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
    }
    var intTime = {
      identify: (value) => typeof value === "bigint" || Number.isInteger(value),
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
      resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
      stringify: stringifySexagesimal
    };
    var floatTime = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
      resolve: (str) => parseSexagesimal(str, false),
      stringify: stringifySexagesimal
    };
    var timestamp = {
      identify: (value) => value instanceof Date,
      default: true,
      tag: "tag:yaml.org,2002:timestamp",
      // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
      // may be omitted altogether, resulting in a date format. In such a case, the time part is
      // assumed to be 00:00:00Z (start of day, UTC).
      test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
      resolve(str) {
        const match = str.match(timestamp.test);
        if (!match)
          throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
        const [, year, month, day, hour, minute, second] = match.map(Number);
        const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
        let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match[8];
        if (tz && tz !== "Z") {
          let d = parseSexagesimal(tz, false);
          if (Math.abs(d) < 30)
            d *= 60;
          date -= 6e4 * d;
        }
        return new Date(date);
      },
      stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
    };
    exports.floatTime = floatTime;
    exports.intTime = intTime;
    exports.timestamp = timestamp;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema4 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var binary = require_binary();
    var bool = require_bool2();
    var float = require_float2();
    var int = require_int2();
    var merge2 = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var set = require_set();
    var timestamp = require_timestamp();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.trueTag,
      bool.falseTag,
      int.intBin,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float,
      binary.binary,
      merge2.merge,
      omap.omap,
      pairs.pairs,
      set.set,
      timestamp.intTime,
      timestamp.floatTime,
      timestamp.timestamp
    ];
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS({
  "node_modules/yaml/dist/schema/tags.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = require_schema2();
    var schema$1 = require_schema3();
    var binary = require_binary();
    var merge2 = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var schema$2 = require_schema4();
    var set = require_set();
    var timestamp = require_timestamp();
    var schemas = /* @__PURE__ */ new Map([
      ["core", schema.schema],
      ["failsafe", [map.map, seq.seq, string.string]],
      ["json", schema$1.schema],
      ["yaml11", schema$2.schema],
      ["yaml-1.1", schema$2.schema]
    ]);
    var tagsByName = {
      binary: binary.binary,
      bool: bool.boolTag,
      float: float.float,
      floatExp: float.floatExp,
      floatNaN: float.floatNaN,
      floatTime: timestamp.floatTime,
      int: int.int,
      intHex: int.intHex,
      intOct: int.intOct,
      intTime: timestamp.intTime,
      map: map.map,
      merge: merge2.merge,
      null: _null.nullTag,
      omap: omap.omap,
      pairs: pairs.pairs,
      seq: seq.seq,
      set: set.set,
      timestamp: timestamp.timestamp
    };
    var coreKnownTags = {
      "tag:yaml.org,2002:binary": binary.binary,
      "tag:yaml.org,2002:merge": merge2.merge,
      "tag:yaml.org,2002:omap": omap.omap,
      "tag:yaml.org,2002:pairs": pairs.pairs,
      "tag:yaml.org,2002:set": set.set,
      "tag:yaml.org,2002:timestamp": timestamp.timestamp
    };
    function getTags(customTags, schemaName, addMergeTag) {
      const schemaTags = schemas.get(schemaName);
      if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge2.merge) ? schemaTags.concat(merge2.merge) : schemaTags.slice();
      }
      let tags = schemaTags;
      if (!tags) {
        if (Array.isArray(customTags))
          tags = [];
        else {
          const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
        }
      }
      if (Array.isArray(customTags)) {
        for (const tag of customTags)
          tags = tags.concat(tag);
      } else if (typeof customTags === "function") {
        tags = customTags(tags.slice());
      }
      if (addMergeTag)
        tags = tags.concat(merge2.merge);
      return tags.reduce((tags2, tag) => {
        const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
        if (!tagObj) {
          const tagName = JSON.stringify(tag);
          const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
        }
        if (!tags2.includes(tagObj))
          tags2.push(tagObj);
        return tags2;
      }, []);
    }
    exports.coreKnownTags = coreKnownTags;
    exports.getTags = getTags;
  }
});

// node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS({
  "node_modules/yaml/dist/schema/Schema.js"(exports) {
    "use strict";
    var identity = require_identity();
    var map = require_map();
    var seq = require_seq();
    var string = require_string();
    var tags = require_tags();
    var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    var Schema = class _Schema {
      constructor({ compat, customTags, merge: merge2, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
        this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
        this.name = typeof schema === "string" && schema || "core";
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge2);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity.MAP, { value: map.map });
        Object.defineProperty(this, identity.SCALAR, { value: string.string });
        Object.defineProperty(this, identity.SEQ, { value: seq.seq });
        this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
      }
      clone() {
        const copy3 = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
        copy3.tags = this.tags.slice();
        return copy3;
      }
    };
    exports.Schema = Schema;
  }
});

// node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyDocument.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify2 = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyDocument(doc, options) {
      const lines = [];
      let hasDirectives = options.directives === true;
      if (options.directives !== false && doc.directives) {
        const dir = doc.directives.toString(doc);
        if (dir) {
          lines.push(dir);
          hasDirectives = true;
        } else if (doc.directives.docStart)
          hasDirectives = true;
      }
      if (hasDirectives)
        lines.push("---");
      const ctx = stringify2.createStringifyContext(doc, options);
      const { commentString } = ctx.options;
      if (doc.commentBefore) {
        if (lines.length !== 1)
          lines.unshift("");
        const cs = commentString(doc.commentBefore);
        lines.unshift(stringifyComment.indentComment(cs, ""));
      }
      let chompKeep = false;
      let contentComment = null;
      if (doc.contents) {
        if (identity.isNode(doc.contents)) {
          if (doc.contents.spaceBefore && hasDirectives)
            lines.push("");
          if (doc.contents.commentBefore) {
            const cs = commentString(doc.contents.commentBefore);
            lines.push(stringifyComment.indentComment(cs, ""));
          }
          ctx.forceBlockIndent = !!doc.comment;
          contentComment = doc.contents.comment;
        }
        const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
        let body = stringify2.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
        if (contentComment)
          body += stringifyComment.lineComment(body, "", commentString(contentComment));
        if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
          lines[lines.length - 1] = `--- ${body}`;
        } else
          lines.push(body);
      } else {
        lines.push(stringify2.stringify(doc.contents, ctx));
      }
      if (doc.directives?.docEnd) {
        if (doc.comment) {
          const cs = commentString(doc.comment);
          if (cs.includes("\n")) {
            lines.push("...");
            lines.push(stringifyComment.indentComment(cs, ""));
          } else {
            lines.push(`... ${cs}`);
          }
        } else {
          lines.push("...");
        }
      } else {
        let dc = doc.comment;
        if (dc && chompKeep)
          dc = dc.replace(/^\n+/, "");
        if (dc) {
          if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
            lines.push("");
          lines.push(stringifyComment.indentComment(commentString(dc), ""));
        }
      }
      return lines.join("\n") + "\n";
    }
    exports.stringifyDocument = stringifyDocument;
  }
});

// node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS({
  "node_modules/yaml/dist/doc/Document.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var toJS = require_toJS();
    var Schema = require_Schema();
    var stringifyDocument = require_stringifyDocument();
    var anchors = require_anchors();
    var applyReviver = require_applyReviver();
    var createNode = require_createNode();
    var directives = require_directives();
    var Document = class _Document {
      constructor(value, replacer, options) {
        this.commentBefore = null;
        this.comment = null;
        this.errors = [];
        this.warnings = [];
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
        let _replacer = null;
        if (typeof replacer === "function" || Array.isArray(replacer)) {
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const opt = Object.assign({
          intAsBigInt: false,
          keepSourceTokens: false,
          logLevel: "warn",
          prettyErrors: true,
          strict: true,
          stringKeys: false,
          uniqueKeys: true,
          version: "1.2"
        }, options);
        this.options = opt;
        let { version } = opt;
        if (options?._directives) {
          this.directives = options._directives.atDocument();
          if (this.directives.yaml.explicit)
            version = this.directives.yaml.version;
        } else
          this.directives = new directives.Directives({ version });
        this.setSchema(version, options);
        this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
      }
      /**
       * Create a deep copy of this Document and its contents.
       *
       * Custom Node values that inherit from `Object` still refer to their original instances.
       */
      clone() {
        const copy3 = Object.create(_Document.prototype, {
          [identity.NODE_TYPE]: { value: identity.DOC }
        });
        copy3.commentBefore = this.commentBefore;
        copy3.comment = this.comment;
        copy3.errors = this.errors.slice();
        copy3.warnings = this.warnings.slice();
        copy3.options = Object.assign({}, this.options);
        if (this.directives)
          copy3.directives = this.directives.clone();
        copy3.schema = this.schema.clone();
        copy3.contents = identity.isNode(this.contents) ? this.contents.clone(copy3.schema) : this.contents;
        if (this.range)
          copy3.range = this.range.slice();
        return copy3;
      }
      /** Adds a value to the document. */
      add(value) {
        if (assertCollection(this.contents))
          this.contents.add(value);
      }
      /** Adds a value to the document. */
      addIn(path, value) {
        if (assertCollection(this.contents))
          this.contents.addIn(path, value);
      }
      /**
       * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
       *
       * If `node` already has an anchor, `name` is ignored.
       * Otherwise, the `node.anchor` value will be set to `name`,
       * or if an anchor with that name is already present in the document,
       * `name` will be used as a prefix for a new unique anchor.
       * If `name` is undefined, the generated anchor will use 'a' as a prefix.
       */
      createAlias(node, name) {
        if (!node.anchor) {
          const prev = anchors.anchorNames(this);
          node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
        }
        return new Alias.Alias(node.anchor);
      }
      createNode(value, replacer, options) {
        let _replacer = void 0;
        if (typeof replacer === "function") {
          value = replacer.call({ "": value }, "", value);
          _replacer = replacer;
        } else if (Array.isArray(replacer)) {
          const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
          const asStr = replacer.filter(keyToStr).map(String);
          if (asStr.length > 0)
            replacer = replacer.concat(asStr);
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
        const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(
          this,
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          anchorPrefix || "a"
        );
        const ctx = {
          aliasDuplicateObjects: aliasDuplicateObjects ?? true,
          keepUndefined: keepUndefined ?? false,
          onAnchor,
          onTagObj,
          replacer: _replacer,
          schema: this.schema,
          sourceObjects
        };
        const node = createNode.createNode(value, tag, ctx);
        if (flow && identity.isCollection(node))
          node.flow = true;
        setAnchors();
        return node;
      }
      /**
       * Convert a key and a value into a `Pair` using the current schema,
       * recursively wrapping all values as `Scalar` or `Collection` nodes.
       */
      createPair(key, value, options = {}) {
        const k2 = this.createNode(key, null, options);
        const v = this.createNode(value, null, options);
        return new Pair.Pair(k2, v);
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        return assertCollection(this.contents) ? this.contents.delete(key) : false;
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        if (Collection.isEmptyPath(path)) {
          if (this.contents == null)
            return false;
          this.contents = null;
          return true;
        }
        return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      get(key, keepScalar) {
        return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
      }
      /**
       * Returns item at `path`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        if (Collection.isEmptyPath(path))
          return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
        return identity.isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
      }
      /**
       * Checks if the document includes a value with the key `key`.
       */
      has(key) {
        return identity.isCollection(this.contents) ? this.contents.has(key) : false;
      }
      /**
       * Checks if the document includes a value at `path`.
       */
      hasIn(path) {
        if (Collection.isEmptyPath(path))
          return this.contents !== void 0;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path) : false;
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      set(key, value) {
        if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, [key], value);
        } else if (assertCollection(this.contents)) {
          this.contents.set(key, value);
        }
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        if (Collection.isEmptyPath(path)) {
          this.contents = value;
        } else if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, Array.from(path), value);
        } else if (assertCollection(this.contents)) {
          this.contents.setIn(path, value);
        }
      }
      /**
       * Change the YAML version and schema used by the document.
       * A `null` version disables support for directives, explicit tags, anchors, and aliases.
       * It also requires the `schema` option to be given as a `Schema` instance value.
       *
       * Overrides all previously set schema options.
       */
      setSchema(version, options = {}) {
        if (typeof version === "number")
          version = String(version);
        let opt;
        switch (version) {
          case "1.1":
            if (this.directives)
              this.directives.yaml.version = "1.1";
            else
              this.directives = new directives.Directives({ version: "1.1" });
            opt = { resolveKnownTags: false, schema: "yaml-1.1" };
            break;
          case "1.2":
          case "next":
            if (this.directives)
              this.directives.yaml.version = version;
            else
              this.directives = new directives.Directives({ version });
            opt = { resolveKnownTags: true, schema: "core" };
            break;
          case null:
            if (this.directives)
              delete this.directives;
            opt = null;
            break;
          default: {
            const sv = JSON.stringify(version);
            throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
          }
        }
        if (options.schema instanceof Object)
          this.schema = options.schema;
        else if (opt)
          this.schema = new Schema.Schema(Object.assign(opt, options));
        else
          throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
      }
      // json & jsonArg are only used from toJSON()
      toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc: this,
          keep: !json,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
      /**
       * A JSON representation of the document `contents`.
       *
       * @param jsonArg Used by `JSON.stringify` to indicate the array index or
       *   property name.
       */
      toJSON(jsonArg, onAnchor) {
        return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
      }
      /** A YAML representation of the document. */
      toString(options = {}) {
        if (this.errors.length > 0)
          throw new Error("Document with errors cannot be stringified");
        if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
          const s = JSON.stringify(options.indent);
          throw new Error(`"indent" option must be a positive integer, not ${s}`);
        }
        return stringifyDocument.stringifyDocument(this, options);
      }
    };
    function assertCollection(contents) {
      if (identity.isCollection(contents))
        return true;
      throw new Error("Expected a YAML collection as document contents");
    }
    exports.Document = Document;
  }
});

// node_modules/yaml/dist/errors.js
var require_errors2 = __commonJS({
  "node_modules/yaml/dist/errors.js"(exports) {
    "use strict";
    var YAMLError = class extends Error {
      constructor(name, pos, code, message) {
        super();
        this.name = name;
        this.code = code;
        this.message = message;
        this.pos = pos;
      }
    };
    var YAMLParseError = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLParseError", pos, code, message);
      }
    };
    var YAMLWarning = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLWarning", pos, code, message);
      }
    };
    var prettifyError = (src, lc) => (error) => {
      if (error.pos[0] === -1)
        return;
      error.linePos = error.pos.map((pos) => lc.linePos(pos));
      const { line, col } = error.linePos[0];
      error.message += ` at line ${line}, column ${col}`;
      let ci = col - 1;
      let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
      if (ci >= 60 && lineStr.length > 80) {
        const trimStart = Math.min(ci - 39, lineStr.length - 79);
        lineStr = "\u2026" + lineStr.substring(trimStart);
        ci -= trimStart - 1;
      }
      if (lineStr.length > 80)
        lineStr = lineStr.substring(0, 79) + "\u2026";
      if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
        let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
        if (prev.length > 80)
          prev = prev.substring(0, 79) + "\u2026\n";
        lineStr = prev + lineStr;
      }
      if (/[^ ]/.test(lineStr)) {
        let count = 1;
        const end = error.linePos[1];
        if (end?.line === line && end.col > col) {
          count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = " ".repeat(ci) + "^".repeat(count);
        error.message += `:

${lineStr}
${pointer}
`;
      }
    };
    exports.YAMLError = YAMLError;
    exports.YAMLParseError = YAMLParseError;
    exports.YAMLWarning = YAMLWarning;
    exports.prettifyError = prettifyError;
  }
});

// node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS({
  "node_modules/yaml/dist/compose/resolve-props.js"(exports) {
    "use strict";
    function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
      let spaceBefore = false;
      let atNewline = startOnNewline;
      let hasSpace = startOnNewline;
      let comment = "";
      let commentSep = "";
      let hasNewline = false;
      let reqSpace = false;
      let tab = null;
      let anchor = null;
      let tag = null;
      let newlineAfterProp = null;
      let comma = null;
      let found = null;
      let start = null;
      for (const token of tokens) {
        if (reqSpace) {
          if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
            onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
          reqSpace = false;
        }
        if (tab) {
          if (atNewline && token.type !== "comment" && token.type !== "newline") {
            onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
          }
          tab = null;
        }
        switch (token.type) {
          case "space":
            if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
              tab = token;
            }
            hasSpace = true;
            break;
          case "comment": {
            if (!hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = token.source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += commentSep + cb;
            commentSep = "";
            atNewline = false;
            break;
          }
          case "newline":
            if (atNewline) {
              if (comment)
                comment += token.source;
              else if (!found || indicator !== "seq-item-ind")
                spaceBefore = true;
            } else
              commentSep += token.source;
            atNewline = true;
            hasNewline = true;
            if (anchor || tag)
              newlineAfterProp = token;
            hasSpace = true;
            break;
          case "anchor":
            if (anchor)
              onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
            if (token.source.endsWith(":"))
              onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
            anchor = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          case "tag": {
            if (tag)
              onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
            tag = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          }
          case indicator:
            if (anchor || tag)
              onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
            if (found)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
            found = token;
            atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
            hasSpace = false;
            break;
          case "comma":
            if (flow) {
              if (comma)
                onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
              comma = token;
              atNewline = false;
              hasSpace = false;
              break;
            }
          // else fallthrough
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
            atNewline = false;
            hasSpace = false;
        }
      }
      const last = tokens[tokens.length - 1];
      const end = last ? last.offset + last.source.length : offset;
      if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
        onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      }
      if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      return {
        comma,
        found,
        spaceBefore,
        comment,
        hasNewline,
        anchor,
        tag,
        newlineAfterProp,
        end,
        start: start ?? end
      };
    }
    exports.resolveProps = resolveProps;
  }
});

// node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS({
  "node_modules/yaml/dist/compose/util-contains-newline.js"(exports) {
    "use strict";
    function containsNewline(key) {
      if (!key)
        return null;
      switch (key.type) {
        case "alias":
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          if (key.source.includes("\n"))
            return true;
          if (key.end) {
            for (const st2 of key.end)
              if (st2.type === "newline")
                return true;
          }
          return false;
        case "flow-collection":
          for (const it2 of key.items) {
            for (const st2 of it2.start)
              if (st2.type === "newline")
                return true;
            if (it2.sep) {
              for (const st2 of it2.sep)
                if (st2.type === "newline")
                  return true;
            }
            if (containsNewline(it2.key) || containsNewline(it2.value))
              return true;
          }
          return false;
        default:
          return true;
      }
    }
    exports.containsNewline = containsNewline;
  }
});

// node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS({
  "node_modules/yaml/dist/compose/util-flow-indent-check.js"(exports) {
    "use strict";
    var utilContainsNewline = require_util_contains_newline();
    function flowIndentCheck(indent, fc, onError) {
      if (fc?.type === "flow-collection") {
        const end = fc.end[0];
        if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) {
          const msg = "Flow end indicator should be more indented than parent";
          onError(end, "BAD_INDENT", msg, true);
        }
      }
    }
    exports.flowIndentCheck = flowIndentCheck;
  }
});

// node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS({
  "node_modules/yaml/dist/compose/util-map-includes.js"(exports) {
    "use strict";
    var identity = require_identity();
    function mapIncludes(ctx, items, search) {
      const { uniqueKeys } = ctx.options;
      if (uniqueKeys === false)
        return false;
      const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity.isScalar(a) && identity.isScalar(b) && a.value === b.value;
      return items.some((pair) => isEqual(pair.key, search));
    }
    exports.mapIncludes = mapIncludes;
  }
});

// node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-map.js"(exports) {
    "use strict";
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    var utilMapIncludes = require_util_map_includes();
    var startColMsg = "All mapping items must start at the same column";
    function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
      const map = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      let offset = bm.offset;
      let commentEnd = null;
      for (const collItem of bm.items) {
        const { start, key, sep: sep2, value } = collItem;
        const keyProps = resolveProps.resolveProps(start, {
          indicator: "explicit-key-ind",
          next: key ?? sep2?.[0],
          offset,
          onError,
          parentIndent: bm.indent,
          startOnNewline: true
        });
        const implicitKey = !keyProps.found;
        if (implicitKey) {
          if (key) {
            if (key.type === "block-seq")
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
            else if ("indent" in key && key.indent !== bm.indent)
              onError(offset, "BAD_INDENT", startColMsg);
          }
          if (!keyProps.anchor && !keyProps.tag && !sep2) {
            commentEnd = keyProps.end;
            if (keyProps.comment) {
              if (map.comment)
                map.comment += "\n" + keyProps.comment;
              else
                map.comment = keyProps.comment;
            }
            continue;
          }
          if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
            onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
          }
        } else if (keyProps.found?.indent !== bm.indent) {
          onError(offset, "BAD_INDENT", startColMsg);
        }
        ctx.atKey = true;
        const keyStart = keyProps.end;
        const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
        ctx.atKey = false;
        if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        const valueProps = resolveProps.resolveProps(sep2 ?? [], {
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: bm.indent,
          startOnNewline: !key || key.type === "block-scalar"
        });
        offset = valueProps.end;
        if (valueProps.found) {
          if (implicitKey) {
            if (value?.type === "block-map" && !valueProps.hasNewline)
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
            if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
              onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep2, null, valueProps, onError);
          if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
          offset = valueNode.range[2];
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        } else {
          if (implicitKey)
            onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
          if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        }
      }
      if (commentEnd && commentEnd < offset)
        onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
      map.range = [bm.offset, offset, commentEnd ?? offset];
      return map;
    }
    exports.resolveBlockMap = resolveBlockMap;
  }
});

// node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-seq.js"(exports) {
    "use strict";
    var YAMLSeq = require_YAMLSeq();
    var resolveProps = require_resolve_props();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
      const seq = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = bs.offset;
      let commentEnd = null;
      for (const { start, value } of bs.items) {
        const props = resolveProps.resolveProps(start, {
          indicator: "seq-item-ind",
          next: value,
          offset,
          onError,
          parentIndent: bs.indent,
          startOnNewline: true
        });
        if (!props.found) {
          if (props.anchor || props.tag || value) {
            if (value?.type === "block-seq")
              onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
            else
              onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
          } else {
            commentEnd = props.end;
            if (props.comment)
              seq.comment = props.comment;
            continue;
          }
        }
        const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
        offset = node.range[2];
        seq.items.push(node);
      }
      seq.range = [bs.offset, offset, commentEnd ?? offset];
      return seq;
    }
    exports.resolveBlockSeq = resolveBlockSeq;
  }
});

// node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS({
  "node_modules/yaml/dist/compose/resolve-end.js"(exports) {
    "use strict";
    function resolveEnd(end, offset, reqSpace, onError) {
      let comment = "";
      if (end) {
        let hasSpace = false;
        let sep2 = "";
        for (const token of end) {
          const { source, type } = token;
          switch (type) {
            case "space":
              hasSpace = true;
              break;
            case "comment": {
              if (reqSpace && !hasSpace)
                onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
              const cb = source.substring(1) || " ";
              if (!comment)
                comment = cb;
              else
                comment += sep2 + cb;
              sep2 = "";
              break;
            }
            case "newline":
              if (comment)
                sep2 += source;
              hasSpace = true;
              break;
            default:
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
          }
          offset += source.length;
        }
      }
      return { comment, offset };
    }
    exports.resolveEnd = resolveEnd;
  }
});

// node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS({
  "node_modules/yaml/dist/compose/resolve-flow-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilMapIncludes = require_util_map_includes();
    var blockMsg = "Block collections are not allowed within flow collections";
    var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
    function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
      const isMap = fc.start.source === "{";
      const fcName = isMap ? "flow map" : "flow sequence";
      const NodeClass = tag?.nodeClass ?? (isMap ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq);
      const coll = new NodeClass(ctx.schema);
      coll.flow = true;
      const atRoot = ctx.atRoot;
      if (atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = fc.offset + fc.start.source.length;
      for (let i = 0; i < fc.items.length; ++i) {
        const collItem = fc.items[i];
        const { start, key, sep: sep2, value } = collItem;
        const props = resolveProps.resolveProps(start, {
          flow: fcName,
          indicator: "explicit-key-ind",
          next: key ?? sep2?.[0],
          offset,
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (!props.found) {
          if (!props.anchor && !props.tag && !sep2 && !value) {
            if (i === 0 && props.comma)
              onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
            else if (i < fc.items.length - 1)
              onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
            if (props.comment) {
              if (coll.comment)
                coll.comment += "\n" + props.comment;
              else
                coll.comment = props.comment;
            }
            offset = props.end;
            continue;
          }
          if (!isMap && ctx.options.strict && utilContainsNewline.containsNewline(key))
            onError(
              key,
              // checked by containsNewline()
              "MULTILINE_IMPLICIT_KEY",
              "Implicit keys of flow sequence pairs need to be on a single line"
            );
        }
        if (i === 0) {
          if (props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        } else {
          if (!props.comma)
            onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
          if (props.comment) {
            let prevItemComment = "";
            loop: for (const st2 of start) {
              switch (st2.type) {
                case "comma":
                case "space":
                  break;
                case "comment":
                  prevItemComment = st2.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
            if (prevItemComment) {
              let prev = coll.items[coll.items.length - 1];
              if (identity.isPair(prev))
                prev = prev.value ?? prev.key;
              if (prev.comment)
                prev.comment += "\n" + prevItemComment;
              else
                prev.comment = prevItemComment;
              props.comment = props.comment.substring(prevItemComment.length + 1);
            }
          }
        }
        if (!isMap && !sep2 && !props.found) {
          const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep2, null, props, onError);
          coll.items.push(valueNode);
          offset = valueNode.range[2];
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else {
          ctx.atKey = true;
          const keyStart = props.end;
          const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
          if (isBlock(key))
            onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
          ctx.atKey = false;
          const valueProps = resolveProps.resolveProps(sep2 ?? [], {
            flow: fcName,
            indicator: "map-value-ind",
            next: value,
            offset: keyNode.range[2],
            onError,
            parentIndent: fc.indent,
            startOnNewline: false
          });
          if (valueProps.found) {
            if (!isMap && !props.found && ctx.options.strict) {
              if (sep2)
                for (const st2 of sep2) {
                  if (st2 === valueProps.found)
                    break;
                  if (st2.type === "newline") {
                    onError(st2, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                    break;
                  }
                }
              if (props.start < valueProps.found.offset - 1024)
                onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
            }
          } else if (value) {
            if ("source" in value && value.source?.[0] === ":")
              onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
            else
              onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep2, null, valueProps, onError) : null;
          if (valueNode) {
            if (isBlock(value))
              onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
          } else if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          if (isMap) {
            const map = coll;
            if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
              onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
            map.items.push(pair);
          } else {
            const map = new YAMLMap.YAMLMap(ctx.schema);
            map.flow = true;
            map.items.push(pair);
            const endRange = (valueNode ?? keyNode).range;
            map.range = [keyNode.range[0], endRange[1], endRange[2]];
            coll.items.push(map);
          }
          offset = valueNode ? valueNode.range[2] : valueProps.end;
        }
      }
      const expectedEnd = isMap ? "}" : "]";
      const [ce2, ...ee2] = fc.end;
      let cePos = offset;
      if (ce2?.source === expectedEnd)
        cePos = ce2.offset + ce2.source.length;
      else {
        const name = fcName[0].toUpperCase() + fcName.substring(1);
        const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
        onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
        if (ce2 && ce2.source.length !== 1)
          ee2.unshift(ce2);
      }
      if (ee2.length > 0) {
        const end = resolveEnd.resolveEnd(ee2, cePos, ctx.options.strict, onError);
        if (end.comment) {
          if (coll.comment)
            coll.comment += "\n" + end.comment;
          else
            coll.comment = end.comment;
        }
        coll.range = [fc.offset, cePos, end.offset];
      } else {
        coll.range = [fc.offset, cePos, cePos];
      }
      return coll;
    }
    exports.resolveFlowCollection = resolveFlowCollection;
  }
});

// node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS({
  "node_modules/yaml/dist/compose/compose-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveBlockMap = require_resolve_block_map();
    var resolveBlockSeq = require_resolve_block_seq();
    var resolveFlowCollection = require_resolve_flow_collection();
    function resolveCollection(CN, ctx, token, onError, tagName, tag) {
      const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
      const Coll = coll.constructor;
      if (tagName === "!" || tagName === Coll.tagName) {
        coll.tag = Coll.tagName;
        return coll;
      }
      if (tagName)
        coll.tag = tagName;
      return coll;
    }
    function composeCollection(CN, ctx, token, props, onError) {
      const tagToken = props.tag;
      const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
      if (token.type === "block-seq") {
        const { anchor, newlineAfterProp: nl } = props;
        const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
        if (lastProp && (!nl || nl.offset < lastProp.offset)) {
          const message = "Missing newline after block sequence props";
          onError(lastProp, "MISSING_CHAR", message);
        }
      }
      const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
      if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") {
        return resolveCollection(CN, ctx, token, onError, tagName);
      }
      let tag = ctx.schema.tags.find((t2) => t2.tag === tagName && t2.collection === expType);
      if (!tag) {
        const kt3 = ctx.schema.knownTags[tagName];
        if (kt3?.collection === expType) {
          ctx.schema.tags.push(Object.assign({}, kt3, { default: false }));
          tag = kt3;
        } else {
          if (kt3) {
            onError(tagToken, "BAD_COLLECTION_TYPE", `${kt3.tag} used for ${expType} collection, but expects ${kt3.collection ?? "scalar"}`, true);
          } else {
            onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
          }
          return resolveCollection(CN, ctx, token, onError, tagName);
        }
      }
      const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
      const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
      const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
      node.range = coll.range;
      node.tag = tagName;
      if (tag?.format)
        node.format = tag.format;
      return node;
    }
    exports.composeCollection = composeCollection;
  }
});

// node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function resolveBlockScalar(ctx, scalar, onError) {
      const start = scalar.offset;
      const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
      if (!header)
        return { value: "", type: null, comment: "", range: [start, start, start] };
      const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
      const lines = scalar.source ? splitLines(scalar.source) : [];
      let chompStart = lines.length;
      for (let i = lines.length - 1; i >= 0; --i) {
        const content = lines[i][1];
        if (content === "" || content === "\r")
          chompStart = i;
        else
          break;
      }
      if (chompStart === 0) {
        const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
        let end2 = start + header.length;
        if (scalar.source)
          end2 += scalar.source.length;
        return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
      }
      let trimIndent = scalar.indent + header.indent;
      let offset = scalar.offset + header.length;
      let contentStart = 0;
      for (let i = 0; i < chompStart; ++i) {
        const [indent, content] = lines[i];
        if (content === "" || content === "\r") {
          if (header.indent === 0 && indent.length > trimIndent)
            trimIndent = indent.length;
        } else {
          if (indent.length < trimIndent) {
            const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
            onError(offset + indent.length, "MISSING_CHAR", message);
          }
          if (header.indent === 0)
            trimIndent = indent.length;
          contentStart = i;
          if (trimIndent === 0 && !ctx.atRoot) {
            const message = "Block scalar values in collections must be indented";
            onError(offset, "BAD_INDENT", message);
          }
          break;
        }
        offset += indent.length + content.length + 1;
      }
      for (let i = lines.length - 1; i >= chompStart; --i) {
        if (lines[i][0].length > trimIndent)
          chompStart = i + 1;
      }
      let value = "";
      let sep2 = "";
      let prevMoreIndented = false;
      for (let i = 0; i < contentStart; ++i)
        value += lines[i][0].slice(trimIndent) + "\n";
      for (let i = contentStart; i < chompStart; ++i) {
        let [indent, content] = lines[i];
        offset += indent.length + content.length + 1;
        const crlf = content[content.length - 1] === "\r";
        if (crlf)
          content = content.slice(0, -1);
        if (content && indent.length < trimIndent) {
          const src = header.indent ? "explicit indentation indicator" : "first line";
          const message = `Block scalar lines must not be less indented than their ${src}`;
          onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
          indent = "";
        }
        if (type === Scalar.Scalar.BLOCK_LITERAL) {
          value += sep2 + indent.slice(trimIndent) + content;
          sep2 = "\n";
        } else if (indent.length > trimIndent || content[0] === "	") {
          if (sep2 === " ")
            sep2 = "\n";
          else if (!prevMoreIndented && sep2 === "\n")
            sep2 = "\n\n";
          value += sep2 + indent.slice(trimIndent) + content;
          sep2 = "\n";
          prevMoreIndented = true;
        } else if (content === "") {
          if (sep2 === "\n")
            value += "\n";
          else
            sep2 = "\n";
        } else {
          value += sep2 + content;
          sep2 = " ";
          prevMoreIndented = false;
        }
      }
      switch (header.chomp) {
        case "-":
          break;
        case "+":
          for (let i = chompStart; i < lines.length; ++i)
            value += "\n" + lines[i][0].slice(trimIndent);
          if (value[value.length - 1] !== "\n")
            value += "\n";
          break;
        default:
          value += "\n";
      }
      const end = start + header.length + scalar.source.length;
      return { value, type, comment: header.comment, range: [start, end, end] };
    }
    function parseBlockScalarHeader({ offset, props }, strict, onError) {
      if (props[0].type !== "block-scalar-header") {
        onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
        return null;
      }
      const { source } = props[0];
      const mode = source[0];
      let indent = 0;
      let chomp = "";
      let error = -1;
      for (let i = 1; i < source.length; ++i) {
        const ch = source[i];
        if (!chomp && (ch === "-" || ch === "+"))
          chomp = ch;
        else {
          const n = Number(ch);
          if (!indent && n)
            indent = n;
          else if (error === -1)
            error = offset + i;
        }
      }
      if (error !== -1)
        onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
      let hasSpace = false;
      let comment = "";
      let length = source.length;
      for (let i = 1; i < props.length; ++i) {
        const token = props[i];
        switch (token.type) {
          case "space":
            hasSpace = true;
          // fallthrough
          case "newline":
            length += token.source.length;
            break;
          case "comment":
            if (strict && !hasSpace) {
              const message = "Comments must be separated from other tokens by white space characters";
              onError(token, "MISSING_CHAR", message);
            }
            length += token.source.length;
            comment = token.source.substring(1);
            break;
          case "error":
            onError(token, "UNEXPECTED_TOKEN", token.message);
            length += token.source.length;
            break;
          /* istanbul ignore next should not happen */
          default: {
            const message = `Unexpected token in block scalar header: ${token.type}`;
            onError(token, "UNEXPECTED_TOKEN", message);
            const ts = token.source;
            if (ts && typeof ts === "string")
              length += ts.length;
          }
        }
      }
      return { mode, indent, chomp, comment, length };
    }
    function splitLines(source) {
      const split = source.split(/\n( *)/);
      const first = split[0];
      const m = first.match(/^( *)/);
      const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
      const lines = [line0];
      for (let i = 1; i < split.length; i += 2)
        lines.push([split[i], split[i + 1]]);
      return lines;
    }
    exports.resolveBlockScalar = resolveBlockScalar;
  }
});

// node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS({
  "node_modules/yaml/dist/compose/resolve-flow-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var resolveEnd = require_resolve_end();
    function resolveFlowScalar(scalar, strict, onError) {
      const { offset, type, source, end } = scalar;
      let _type;
      let value;
      const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
      switch (type) {
        case "scalar":
          _type = Scalar.Scalar.PLAIN;
          value = plainValue(source, _onError);
          break;
        case "single-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_SINGLE;
          value = singleQuotedValue(source, _onError);
          break;
        case "double-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_DOUBLE;
          value = doubleQuotedValue(source, _onError);
          break;
        /* istanbul ignore next should not happen */
        default:
          onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
          return {
            value: "",
            type: null,
            comment: "",
            range: [offset, offset + source.length, offset + source.length]
          };
      }
      const valueEnd = offset + source.length;
      const re2 = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
      return {
        value,
        type: _type,
        comment: re2.comment,
        range: [offset, valueEnd, re2.offset]
      };
    }
    function plainValue(source, onError) {
      let badChar = "";
      switch (source[0]) {
        /* istanbul ignore next should not happen */
        case "	":
          badChar = "a tab character";
          break;
        case ",":
          badChar = "flow indicator character ,";
          break;
        case "%":
          badChar = "directive indicator character %";
          break;
        case "|":
        case ">": {
          badChar = `block scalar indicator ${source[0]}`;
          break;
        }
        case "@":
        case "`": {
          badChar = `reserved character ${source[0]}`;
          break;
        }
      }
      if (badChar)
        onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
      return foldLines(source);
    }
    function singleQuotedValue(source, onError) {
      if (source[source.length - 1] !== "'" || source.length === 1)
        onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
      return foldLines(source.slice(1, -1)).replace(/''/g, "'");
    }
    function foldLines(source) {
      let first, line;
      try {
        first = new RegExp("(.*?)(?<![ 	])[ 	]*\r?\n", "sy");
        line = new RegExp("[ 	]*(.*?)(?:(?<![ 	])[ 	]*)?\r?\n", "sy");
      } catch {
        first = /(.*?)[ \t]*\r?\n/sy;
        line = /[ \t]*(.*?)[ \t]*\r?\n/sy;
      }
      let match = first.exec(source);
      if (!match)
        return source;
      let res = match[1];
      let sep2 = " ";
      let pos = first.lastIndex;
      line.lastIndex = pos;
      while (match = line.exec(source)) {
        if (match[1] === "") {
          if (sep2 === "\n")
            res += sep2;
          else
            sep2 = "\n";
        } else {
          res += sep2 + match[1];
          sep2 = " ";
        }
        pos = line.lastIndex;
      }
      const last = /[ \t]*(.*)/sy;
      last.lastIndex = pos;
      match = last.exec(source);
      return res + sep2 + (match?.[1] ?? "");
    }
    function doubleQuotedValue(source, onError) {
      let res = "";
      for (let i = 1; i < source.length - 1; ++i) {
        const ch = source[i];
        if (ch === "\r" && source[i + 1] === "\n")
          continue;
        if (ch === "\n") {
          const { fold, offset } = foldNewline(source, i);
          res += fold;
          i = offset;
        } else if (ch === "\\") {
          let next = source[++i];
          const cc = escapeCodes[next];
          if (cc)
            res += cc;
          else if (next === "\n") {
            next = source[i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "\r" && source[i + 1] === "\n") {
            next = source[++i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "x" || next === "u" || next === "U") {
            const length = next === "x" ? 2 : next === "u" ? 4 : 8;
            res += parseCharCode(source, i + 1, length, onError);
            i += length;
          } else {
            const raw = source.substr(i - 1, 2);
            onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
            res += raw;
          }
        } else if (ch === " " || ch === "	") {
          const wsStart = i;
          let next = source[i + 1];
          while (next === " " || next === "	")
            next = source[++i + 1];
          if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
            res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
        } else {
          res += ch;
        }
      }
      if (source[source.length - 1] !== '"' || source.length === 1)
        onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
      return res;
    }
    function foldNewline(source, offset) {
      let fold = "";
      let ch = source[offset + 1];
      while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
        if (ch === "\r" && source[offset + 2] !== "\n")
          break;
        if (ch === "\n")
          fold += "\n";
        offset += 1;
        ch = source[offset + 1];
      }
      if (!fold)
        fold = " ";
      return { fold, offset };
    }
    var escapeCodes = {
      "0": "\0",
      // null character
      a: "\x07",
      // bell character
      b: "\b",
      // backspace
      e: "\x1B",
      // escape character
      f: "\f",
      // form feed
      n: "\n",
      // line feed
      r: "\r",
      // carriage return
      t: "	",
      // horizontal tab
      v: "\v",
      // vertical tab
      N: "\x85",
      // Unicode next line
      _: "\xA0",
      // Unicode non-breaking space
      L: "\u2028",
      // Unicode line separator
      P: "\u2029",
      // Unicode paragraph separator
      " ": " ",
      '"': '"',
      "/": "/",
      "\\": "\\",
      "	": "	"
    };
    function parseCharCode(source, offset, length, onError) {
      const cc = source.substr(offset, length);
      const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
      const code = ok ? parseInt(cc, 16) : NaN;
      try {
        return String.fromCodePoint(code);
      } catch {
        const raw = source.substr(offset - 2, length + 2);
        onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        return raw;
      }
    }
    exports.resolveFlowScalar = resolveFlowScalar;
  }
});

// node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS({
  "node_modules/yaml/dist/compose/compose-scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    function composeScalar(ctx, token, tagToken, onError) {
      const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
      const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
      let tag;
      if (ctx.options.stringKeys && ctx.atKey) {
        tag = ctx.schema[identity.SCALAR];
      } else if (tagName)
        tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
      else if (token.type === "scalar")
        tag = findScalarTagByTest(ctx, value, token, onError);
      else
        tag = ctx.schema[identity.SCALAR];
      let scalar;
      try {
        const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
        scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
        scalar = new Scalar.Scalar(value);
      }
      scalar.range = range;
      scalar.source = value;
      if (type)
        scalar.type = type;
      if (tagName)
        scalar.tag = tagName;
      if (tag.format)
        scalar.format = tag.format;
      if (comment)
        scalar.comment = comment;
      return scalar;
    }
    function findScalarTagByName(schema, value, tagName, tagToken, onError) {
      if (tagName === "!")
        return schema[identity.SCALAR];
      const matchWithTest = [];
      for (const tag of schema.tags) {
        if (!tag.collection && tag.tag === tagName) {
          if (tag.default && tag.test)
            matchWithTest.push(tag);
          else
            return tag;
        }
      }
      for (const tag of matchWithTest)
        if (tag.test?.test(value))
          return tag;
      const kt3 = schema.knownTags[tagName];
      if (kt3 && !kt3.collection) {
        schema.tags.push(Object.assign({}, kt3, { default: false, test: void 0 }));
        return kt3;
      }
      onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
      return schema[identity.SCALAR];
    }
    function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
      const tag = schema.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema[identity.SCALAR];
      if (schema.compat) {
        const compat = schema.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema[identity.SCALAR];
        if (tag.tag !== compat.tag) {
          const ts = directives.tagString(tag.tag);
          const cs = directives.tagString(compat.tag);
          const msg = `Value may be parsed as either ${ts} or ${cs}`;
          onError(token, "TAG_RESOLVE_FAILED", msg, true);
        }
      }
      return tag;
    }
    exports.composeScalar = composeScalar;
  }
});

// node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS({
  "node_modules/yaml/dist/compose/util-empty-scalar-position.js"(exports) {
    "use strict";
    function emptyScalarPosition(offset, before, pos) {
      if (before) {
        pos ?? (pos = before.length);
        for (let i = pos - 1; i >= 0; --i) {
          let st2 = before[i];
          switch (st2.type) {
            case "space":
            case "comment":
            case "newline":
              offset -= st2.source.length;
              continue;
          }
          st2 = before[++i];
          while (st2?.type === "space") {
            offset += st2.source.length;
            st2 = before[++i];
          }
          break;
        }
      }
      return offset;
    }
    exports.emptyScalarPosition = emptyScalarPosition;
  }
});

// node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS({
  "node_modules/yaml/dist/compose/compose-node.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var composeCollection = require_compose_collection();
    var composeScalar = require_compose_scalar();
    var resolveEnd = require_resolve_end();
    var utilEmptyScalarPosition = require_util_empty_scalar_position();
    var CN = { composeNode, composeEmptyNode };
    function composeNode(ctx, token, props, onError) {
      const atKey = ctx.atKey;
      const { spaceBefore, comment, anchor, tag } = props;
      let node;
      let isSrcToken = true;
      switch (token.type) {
        case "alias":
          node = composeAlias(ctx, token, onError);
          if (anchor || tag)
            onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
          break;
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "block-scalar":
          node = composeScalar.composeScalar(ctx, token, tag, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
          break;
        case "block-map":
        case "block-seq":
        case "flow-collection":
          try {
            node = composeCollection.composeCollection(CN, ctx, token, props, onError);
            if (anchor)
              node.anchor = anchor.source.substring(1);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            onError(token, "RESOURCE_EXHAUSTION", message);
          }
          break;
        default: {
          const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
          onError(token, "UNEXPECTED_TOKEN", message);
          isSrcToken = false;
        }
      }
      node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
      if (anchor && node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
        const msg = "With stringKeys, all keys must be strings";
        onError(tag ?? token, "NON_STRING_KEY", msg);
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        if (token.type === "scalar" && token.source === "")
          node.comment = comment;
        else
          node.commentBefore = comment;
      }
      if (ctx.options.keepSourceTokens && isSrcToken)
        node.srcToken = token;
      return node;
    }
    function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
      const token = {
        type: "scalar",
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
        indent: -1,
        source: ""
      };
      const node = composeScalar.composeScalar(ctx, token, tag, onError);
      if (anchor) {
        node.anchor = anchor.source.substring(1);
        if (node.anchor === "")
          onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        node.comment = comment;
        node.range[2] = end;
      }
      return node;
    }
    function composeAlias({ options }, { offset, source, end }, onError) {
      const alias = new Alias.Alias(source.substring(1));
      if (alias.source === "")
        onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
      if (alias.source.endsWith(":"))
        onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
      const valueEnd = offset + source.length;
      const re2 = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
      alias.range = [offset, valueEnd, re2.offset];
      if (re2.comment)
        alias.comment = re2.comment;
      return alias;
    }
    exports.composeEmptyNode = composeEmptyNode;
    exports.composeNode = composeNode;
  }
});

// node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS({
  "node_modules/yaml/dist/compose/compose-doc.js"(exports) {
    "use strict";
    var Document = require_Document();
    var composeNode = require_compose_node();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    function composeDoc(options, directives, { offset, start, value, end }, onError) {
      const opts = Object.assign({ _directives: directives }, options);
      const doc = new Document.Document(void 0, opts);
      const ctx = {
        atKey: false,
        atRoot: true,
        directives: doc.directives,
        options: doc.options,
        schema: doc.schema
      };
      const props = resolveProps.resolveProps(start, {
        indicator: "doc-start",
        next: value ?? end?.[0],
        offset,
        onError,
        parentIndent: 0,
        startOnNewline: true
      });
      if (props.found) {
        doc.directives.docStart = true;
        if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
          onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
      }
      doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
      const contentEnd = doc.contents.range[2];
      const re2 = resolveEnd.resolveEnd(end, contentEnd, false, onError);
      if (re2.comment)
        doc.comment = re2.comment;
      doc.range = [offset, contentEnd, re2.offset];
      return doc;
    }
    exports.composeDoc = composeDoc;
  }
});

// node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS({
  "node_modules/yaml/dist/compose/composer.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var directives = require_directives();
    var Document = require_Document();
    var errors = require_errors2();
    var identity = require_identity();
    var composeDoc = require_compose_doc();
    var resolveEnd = require_resolve_end();
    function getErrorPos(src) {
      if (typeof src === "number")
        return [src, src + 1];
      if (Array.isArray(src))
        return src.length === 2 ? src : [src[0], src[1]];
      const { offset, source } = src;
      return [offset, offset + (typeof source === "string" ? source.length : 1)];
    }
    function parsePrelude(prelude) {
      let comment = "";
      let atComment = false;
      let afterEmptyLine = false;
      for (let i = 0; i < prelude.length; ++i) {
        const source = prelude[i];
        switch (source[0]) {
          case "#":
            comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
            atComment = true;
            afterEmptyLine = false;
            break;
          case "%":
            if (prelude[i + 1]?.[0] !== "#")
              i += 1;
            atComment = false;
            break;
          default:
            if (!atComment)
              afterEmptyLine = true;
            atComment = false;
        }
      }
      return { comment, afterEmptyLine };
    }
    var Composer = class {
      constructor(options = {}) {
        this.doc = null;
        this.atDirectives = false;
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
        this.onError = (source, code, message, warning) => {
          const pos = getErrorPos(source);
          if (warning)
            this.warnings.push(new errors.YAMLWarning(pos, code, message));
          else
            this.errors.push(new errors.YAMLParseError(pos, code, message));
        };
        this.directives = new directives.Directives({ version: options.version || "1.2" });
        this.options = options;
      }
      decorate(doc, afterDoc) {
        const { comment, afterEmptyLine } = parsePrelude(this.prelude);
        if (comment) {
          const dc = doc.contents;
          if (afterDoc) {
            doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
          } else if (afterEmptyLine || doc.directives.docStart || !dc) {
            doc.commentBefore = comment;
          } else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
            let it2 = dc.items[0];
            if (identity.isPair(it2))
              it2 = it2.key;
            const cb = it2.commentBefore;
            it2.commentBefore = cb ? `${comment}
${cb}` : comment;
          } else {
            const cb = dc.commentBefore;
            dc.commentBefore = cb ? `${comment}
${cb}` : comment;
          }
        }
        if (afterDoc) {
          for (let i = 0; i < this.errors.length; ++i)
            doc.errors.push(this.errors[i]);
          for (let i = 0; i < this.warnings.length; ++i)
            doc.warnings.push(this.warnings[i]);
        } else {
          doc.errors = this.errors;
          doc.warnings = this.warnings;
        }
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
      }
      /**
       * Current stream status information.
       *
       * Mostly useful at the end of input for an empty stream.
       */
      streamInfo() {
        return {
          comment: parsePrelude(this.prelude).comment,
          directives: this.directives,
          errors: this.errors,
          warnings: this.warnings
        };
      }
      /**
       * Compose tokens into documents.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *compose(tokens, forceDoc = false, endOffset = -1) {
        for (const token of tokens)
          yield* this.next(token);
        yield* this.end(forceDoc, endOffset);
      }
      /** Advance the composer by one CST token. */
      *next(token) {
        if (node_process.env.LOG_STREAM)
          console.dir(token, { depth: null });
        switch (token.type) {
          case "directive":
            this.directives.add(token.source, (offset, message, warning) => {
              const pos = getErrorPos(token);
              pos[0] += offset;
              this.onError(pos, "BAD_DIRECTIVE", message, warning);
            });
            this.prelude.push(token.source);
            this.atDirectives = true;
            break;
          case "document": {
            const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
            if (this.atDirectives && !doc.directives.docStart)
              this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
            this.decorate(doc, false);
            if (this.doc)
              yield this.doc;
            this.doc = doc;
            this.atDirectives = false;
            break;
          }
          case "byte-order-mark":
          case "space":
            break;
          case "comment":
          case "newline":
            this.prelude.push(token.source);
            break;
          case "error": {
            const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
            const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
            if (this.atDirectives || !this.doc)
              this.errors.push(error);
            else
              this.doc.errors.push(error);
            break;
          }
          case "doc-end": {
            if (!this.doc) {
              const msg = "Unexpected doc-end without preceding document";
              this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
              break;
            }
            this.doc.directives.docEnd = true;
            const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
            this.decorate(this.doc, true);
            if (end.comment) {
              const dc = this.doc.comment;
              this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
            }
            this.doc.range[2] = end.offset;
            break;
          }
          default:
            this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
        }
      }
      /**
       * Call at end of input to yield any remaining document.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *end(forceDoc = false, endOffset = -1) {
        if (this.doc) {
          this.decorate(this.doc, true);
          yield this.doc;
          this.doc = null;
        } else if (forceDoc) {
          const opts = Object.assign({ _directives: this.directives }, this.options);
          const doc = new Document.Document(void 0, opts);
          if (this.atDirectives)
            this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
          doc.range = [0, endOffset, endOffset];
          this.decorate(doc, false);
          yield doc;
        }
      }
    };
    exports.Composer = Composer;
  }
});

// node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS({
  "node_modules/yaml/dist/parse/cst-scalar.js"(exports) {
    "use strict";
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    var errors = require_errors2();
    var stringifyString = require_stringifyString();
    function resolveAsScalar(token, strict = true, onError) {
      if (token) {
        const _onError = (pos, code, message) => {
          const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
          if (onError)
            onError(offset, code, message);
          else
            throw new errors.YAMLParseError([offset, offset + 1], code, message);
        };
        switch (token.type) {
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
          case "block-scalar":
            return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
        }
      }
      return null;
    }
    function createScalarToken(value, context) {
      const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey,
        indent: indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      const end = context.end ?? [
        { type: "newline", offset: -1, indent, source: "\n" }
      ];
      switch (source[0]) {
        case "|":
        case ">": {
          const he2 = source.indexOf("\n");
          const head = source.substring(0, he2);
          const body = source.substring(he2 + 1) + "\n";
          const props = [
            { type: "block-scalar-header", offset, indent, source: head }
          ];
          if (!addEndtoBlockProps(props, end))
            props.push({ type: "newline", offset: -1, indent, source: "\n" });
          return { type: "block-scalar", offset, indent, props, source: body };
        }
        case '"':
          return { type: "double-quoted-scalar", offset, indent, source, end };
        case "'":
          return { type: "single-quoted-scalar", offset, indent, source, end };
        default:
          return { type: "scalar", offset, indent, source, end };
      }
    }
    function setScalarValue(token, value, context = {}) {
      let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
      let indent = "indent" in token ? token.indent : null;
      if (afterKey && typeof indent === "number")
        indent += 2;
      if (!type)
        switch (token.type) {
          case "single-quoted-scalar":
            type = "QUOTE_SINGLE";
            break;
          case "double-quoted-scalar":
            type = "QUOTE_DOUBLE";
            break;
          case "block-scalar": {
            const header = token.props[0];
            if (header.type !== "block-scalar-header")
              throw new Error("Invalid block scalar header");
            type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
            break;
          }
          default:
            type = "PLAIN";
        }
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey: implicitKey || indent === null,
        indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      switch (source[0]) {
        case "|":
        case ">":
          setBlockScalarValue(token, source);
          break;
        case '"':
          setFlowScalarValue(token, source, "double-quoted-scalar");
          break;
        case "'":
          setFlowScalarValue(token, source, "single-quoted-scalar");
          break;
        default:
          setFlowScalarValue(token, source, "scalar");
      }
    }
    function setBlockScalarValue(token, source) {
      const he2 = source.indexOf("\n");
      const head = source.substring(0, he2);
      const body = source.substring(he2 + 1) + "\n";
      if (token.type === "block-scalar") {
        const header = token.props[0];
        if (header.type !== "block-scalar-header")
          throw new Error("Invalid block scalar header");
        header.source = head;
        token.source = body;
      } else {
        const { offset } = token;
        const indent = "indent" in token ? token.indent : -1;
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, "end" in token ? token.end : void 0))
          props.push({ type: "newline", offset: -1, indent, source: "\n" });
        for (const key of Object.keys(token))
          if (key !== "type" && key !== "offset")
            delete token[key];
        Object.assign(token, { type: "block-scalar", indent, props, source: body });
      }
    }
    function addEndtoBlockProps(props, end) {
      if (end)
        for (const st2 of end)
          switch (st2.type) {
            case "space":
            case "comment":
              props.push(st2);
              break;
            case "newline":
              props.push(st2);
              return true;
          }
      return false;
    }
    function setFlowScalarValue(token, source, type) {
      switch (token.type) {
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          token.type = type;
          token.source = source;
          break;
        case "block-scalar": {
          const end = token.props.slice(1);
          let oa = source.length;
          if (token.props[0].type === "block-scalar-header")
            oa -= token.props[0].source.length;
          for (const tok of end)
            tok.offset += oa;
          delete token.props;
          Object.assign(token, { type, source, end });
          break;
        }
        case "block-map":
        case "block-seq": {
          const offset = token.offset + source.length;
          const nl = { type: "newline", offset, indent: token.indent, source: "\n" };
          delete token.items;
          Object.assign(token, { type, source, end: [nl] });
          break;
        }
        default: {
          const indent = "indent" in token ? token.indent : -1;
          const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st2) => st2.type === "space" || st2.type === "comment" || st2.type === "newline") : [];
          for (const key of Object.keys(token))
            if (key !== "type" && key !== "offset")
              delete token[key];
          Object.assign(token, { type, indent, source, end });
        }
      }
    }
    exports.createScalarToken = createScalarToken;
    exports.resolveAsScalar = resolveAsScalar;
    exports.setScalarValue = setScalarValue;
  }
});

// node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS({
  "node_modules/yaml/dist/parse/cst-stringify.js"(exports) {
    "use strict";
    var stringify2 = (cst) => "type" in cst ? stringifyToken(cst) : stringifyItem(cst);
    function stringifyToken(token) {
      switch (token.type) {
        case "block-scalar": {
          let res = "";
          for (const tok of token.props)
            res += stringifyToken(tok);
          return res + token.source;
        }
        case "block-map":
        case "block-seq": {
          let res = "";
          for (const item of token.items)
            res += stringifyItem(item);
          return res;
        }
        case "flow-collection": {
          let res = token.start.source;
          for (const item of token.items)
            res += stringifyItem(item);
          for (const st2 of token.end)
            res += st2.source;
          return res;
        }
        case "document": {
          let res = stringifyItem(token);
          if (token.end)
            for (const st2 of token.end)
              res += st2.source;
          return res;
        }
        default: {
          let res = token.source;
          if ("end" in token && token.end)
            for (const st2 of token.end)
              res += st2.source;
          return res;
        }
      }
    }
    function stringifyItem({ start, key, sep: sep2, value }) {
      let res = "";
      for (const st2 of start)
        res += st2.source;
      if (key)
        res += stringifyToken(key);
      if (sep2)
        for (const st2 of sep2)
          res += st2.source;
      if (value)
        res += stringifyToken(value);
      return res;
    }
    exports.stringify = stringify2;
  }
});

// node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS({
  "node_modules/yaml/dist/parse/cst-visit.js"(exports) {
    "use strict";
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove item");
    function visit(cst, visitor) {
      if ("type" in cst && cst.type === "document")
        cst = { start: cst.start, value: cst.value };
      _visit(Object.freeze([]), cst, visitor);
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    visit.itemAtPath = (cst, path) => {
      let item = cst;
      for (const [field, index] of path) {
        const tok = item?.[field];
        if (tok && "items" in tok) {
          item = tok.items[index];
        } else
          return void 0;
      }
      return item;
    };
    visit.parentCollection = (cst, path) => {
      const parent = visit.itemAtPath(cst, path.slice(0, -1));
      const field = path[path.length - 1][0];
      const coll = parent?.[field];
      if (coll && "items" in coll)
        return coll;
      throw new Error("Parent collection not found");
    };
    function _visit(path, item, visitor) {
      let ctrl = visitor(item, path);
      if (typeof ctrl === "symbol")
        return ctrl;
      for (const field of ["key", "value"]) {
        const token = item[field];
        if (token && "items" in token) {
          for (let i = 0; i < token.items.length; ++i) {
            const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              token.items.splice(i, 1);
              i -= 1;
            }
          }
          if (typeof ctrl === "function" && field === "key")
            ctrl = ctrl(item, path);
        }
      }
      return typeof ctrl === "function" ? ctrl(item, path) : ctrl;
    }
    exports.visit = visit;
  }
});

// node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS({
  "node_modules/yaml/dist/parse/cst.js"(exports) {
    "use strict";
    var cstScalar = require_cst_scalar();
    var cstStringify = require_cst_stringify();
    var cstVisit = require_cst_visit();
    var BOM = "\uFEFF";
    var DOCUMENT = "";
    var FLOW_END = "";
    var SCALAR = "";
    var isCollection = (token) => !!token && "items" in token;
    var isScalar = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
    function prettyToken(token) {
      switch (token) {
        case BOM:
          return "<BOM>";
        case DOCUMENT:
          return "<DOC>";
        case FLOW_END:
          return "<FLOW_END>";
        case SCALAR:
          return "<SCALAR>";
        default:
          return JSON.stringify(token);
      }
    }
    function tokenType(source) {
      switch (source) {
        case BOM:
          return "byte-order-mark";
        case DOCUMENT:
          return "doc-mode";
        case FLOW_END:
          return "flow-error-end";
        case SCALAR:
          return "scalar";
        case "---":
          return "doc-start";
        case "...":
          return "doc-end";
        case "":
        case "\n":
        case "\r\n":
          return "newline";
        case "-":
          return "seq-item-ind";
        case "?":
          return "explicit-key-ind";
        case ":":
          return "map-value-ind";
        case "{":
          return "flow-map-start";
        case "}":
          return "flow-map-end";
        case "[":
          return "flow-seq-start";
        case "]":
          return "flow-seq-end";
        case ",":
          return "comma";
      }
      switch (source[0]) {
        case " ":
        case "	":
          return "space";
        case "#":
          return "comment";
        case "%":
          return "directive-line";
        case "*":
          return "alias";
        case "&":
          return "anchor";
        case "!":
          return "tag";
        case "'":
          return "single-quoted-scalar";
        case '"':
          return "double-quoted-scalar";
        case "|":
        case ">":
          return "block-scalar-header";
      }
      return null;
    }
    exports.createScalarToken = cstScalar.createScalarToken;
    exports.resolveAsScalar = cstScalar.resolveAsScalar;
    exports.setScalarValue = cstScalar.setScalarValue;
    exports.stringify = cstStringify.stringify;
    exports.visit = cstVisit.visit;
    exports.BOM = BOM;
    exports.DOCUMENT = DOCUMENT;
    exports.FLOW_END = FLOW_END;
    exports.SCALAR = SCALAR;
    exports.isCollection = isCollection;
    exports.isScalar = isScalar;
    exports.prettyToken = prettyToken;
    exports.tokenType = tokenType;
  }
});

// node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS({
  "node_modules/yaml/dist/parse/lexer.js"(exports) {
    "use strict";
    var cst = require_cst();
    function isEmpty(ch) {
      switch (ch) {
        case void 0:
        case " ":
        case "\n":
        case "\r":
        case "	":
          return true;
        default:
          return false;
      }
    }
    var hexDigits = new Set("0123456789ABCDEFabcdef");
    var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
    var flowIndicatorChars = new Set(",[]{}");
    var invalidAnchorChars = new Set(" ,[]{}\n\r	");
    var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
    var Lexer = class {
      constructor() {
        this.atEnd = false;
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        this.buffer = "";
        this.flowKey = false;
        this.flowLevel = 0;
        this.indentNext = 0;
        this.indentValue = 0;
        this.lineEndPos = null;
        this.next = null;
        this.pos = 0;
      }
      /**
       * Generate YAML tokens from the `source` string. If `incomplete`,
       * a part of the last line may be left as a buffer for the next call.
       *
       * @returns A generator of lexical tokens
       */
      *lex(source, incomplete = false) {
        if (source) {
          if (typeof source !== "string")
            throw TypeError("source is not a string");
          this.buffer = this.buffer ? this.buffer + source : source;
          this.lineEndPos = null;
        }
        this.atEnd = !incomplete;
        let next = this.next ?? "stream";
        while (next && (incomplete || this.hasChars(1)))
          next = yield* this.parseNext(next);
      }
      atLineEnd() {
        let i = this.pos;
        let ch = this.buffer[i];
        while (ch === " " || ch === "	")
          ch = this.buffer[++i];
        if (!ch || ch === "#" || ch === "\n")
          return true;
        if (ch === "\r")
          return this.buffer[i + 1] === "\n";
        return false;
      }
      charAt(n) {
        return this.buffer[this.pos + n];
      }
      continueScalar(offset) {
        let ch = this.buffer[offset];
        if (this.indentNext > 0) {
          let indent = 0;
          while (ch === " ")
            ch = this.buffer[++indent + offset];
          if (ch === "\r") {
            const next = this.buffer[indent + offset + 1];
            if (next === "\n" || !next && !this.atEnd)
              return offset + indent + 1;
          }
          return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
        }
        if (ch === "-" || ch === ".") {
          const dt2 = this.buffer.substr(offset, 3);
          if ((dt2 === "---" || dt2 === "...") && isEmpty(this.buffer[offset + 3]))
            return -1;
        }
        return offset;
      }
      getLine() {
        let end = this.lineEndPos;
        if (typeof end !== "number" || end !== -1 && end < this.pos) {
          end = this.buffer.indexOf("\n", this.pos);
          this.lineEndPos = end;
        }
        if (end === -1)
          return this.atEnd ? this.buffer.substring(this.pos) : null;
        if (this.buffer[end - 1] === "\r")
          end -= 1;
        return this.buffer.substring(this.pos, end);
      }
      hasChars(n) {
        return this.pos + n <= this.buffer.length;
      }
      setNext(state) {
        this.buffer = this.buffer.substring(this.pos);
        this.pos = 0;
        this.lineEndPos = null;
        this.next = state;
        return null;
      }
      peek(n) {
        return this.buffer.substr(this.pos, n);
      }
      *parseNext(next) {
        switch (next) {
          case "stream":
            return yield* this.parseStream();
          case "line-start":
            return yield* this.parseLineStart();
          case "block-start":
            return yield* this.parseBlockStart();
          case "doc":
            return yield* this.parseDocument();
          case "flow":
            return yield* this.parseFlowCollection();
          case "quoted-scalar":
            return yield* this.parseQuotedScalar();
          case "block-scalar":
            return yield* this.parseBlockScalar();
          case "plain-scalar":
            return yield* this.parsePlainScalar();
        }
      }
      *parseStream() {
        let line = this.getLine();
        if (line === null)
          return this.setNext("stream");
        if (line[0] === cst.BOM) {
          yield* this.pushCount(1);
          line = line.substring(1);
        }
        if (line[0] === "%") {
          let dirEnd = line.length;
          let cs = line.indexOf("#");
          while (cs !== -1) {
            const ch = line[cs - 1];
            if (ch === " " || ch === "	") {
              dirEnd = cs - 1;
              break;
            } else {
              cs = line.indexOf("#", cs + 1);
            }
          }
          while (true) {
            const ch = line[dirEnd - 1];
            if (ch === " " || ch === "	")
              dirEnd -= 1;
            else
              break;
          }
          const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
          yield* this.pushCount(line.length - n);
          this.pushNewline();
          return "stream";
        }
        if (this.atLineEnd()) {
          const sp = yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - sp);
          yield* this.pushNewline();
          return "stream";
        }
        yield cst.DOCUMENT;
        return yield* this.parseLineStart();
      }
      *parseLineStart() {
        const ch = this.charAt(0);
        if (!ch && !this.atEnd)
          return this.setNext("line-start");
        if (ch === "-" || ch === ".") {
          if (!this.atEnd && !this.hasChars(4))
            return this.setNext("line-start");
          const s = this.peek(3);
          if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
            yield* this.pushCount(3);
            this.indentValue = 0;
            this.indentNext = 0;
            return s === "---" ? "doc" : "stream";
          }
        }
        this.indentValue = yield* this.pushSpaces(false);
        if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
          this.indentNext = this.indentValue;
        return yield* this.parseBlockStart();
      }
      *parseBlockStart() {
        const [ch0, ch1] = this.peek(2);
        if (!ch1 && !this.atEnd)
          return this.setNext("block-start");
        if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
          const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
          this.indentNext = this.indentValue + 1;
          this.indentValue += n;
          return "block-start";
        }
        return "doc";
      }
      *parseDocument() {
        yield* this.pushSpaces(true);
        const line = this.getLine();
        if (line === null)
          return this.setNext("doc");
        let n = yield* this.pushIndicators();
        switch (line[n]) {
          case "#":
            yield* this.pushCount(line.length - n);
          // fallthrough
          case void 0:
            yield* this.pushNewline();
            return yield* this.parseLineStart();
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel = 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            return "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "doc";
          case '"':
          case "'":
            return yield* this.parseQuotedScalar();
          case "|":
          case ">":
            n += yield* this.parseBlockScalarHeader();
            n += yield* this.pushSpaces(true);
            yield* this.pushCount(line.length - n);
            yield* this.pushNewline();
            return yield* this.parseBlockScalar();
          default:
            return yield* this.parsePlainScalar();
        }
      }
      *parseFlowCollection() {
        let nl, sp;
        let indent = -1;
        do {
          nl = yield* this.pushNewline();
          if (nl > 0) {
            sp = yield* this.pushSpaces(false);
            this.indentValue = indent = sp;
          } else {
            sp = 0;
          }
          sp += yield* this.pushSpaces(true);
        } while (nl + sp > 0);
        const line = this.getLine();
        if (line === null)
          return this.setNext("flow");
        if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
          const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
          if (!atFlowEndMarker) {
            this.flowLevel = 0;
            yield cst.FLOW_END;
            return yield* this.parseLineStart();
          }
        }
        let n = 0;
        while (line[n] === ",") {
          n += yield* this.pushCount(1);
          n += yield* this.pushSpaces(true);
          this.flowKey = false;
        }
        n += yield* this.pushIndicators();
        switch (line[n]) {
          case void 0:
            return "flow";
          case "#":
            yield* this.pushCount(line.length - n);
            return "flow";
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel += 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            this.flowKey = true;
            this.flowLevel -= 1;
            return this.flowLevel ? "flow" : "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "flow";
          case '"':
          case "'":
            this.flowKey = true;
            return yield* this.parseQuotedScalar();
          case ":": {
            const next = this.charAt(1);
            if (this.flowKey || isEmpty(next) || next === ",") {
              this.flowKey = false;
              yield* this.pushCount(1);
              yield* this.pushSpaces(true);
              return "flow";
            }
          }
          // fallthrough
          default:
            this.flowKey = false;
            return yield* this.parsePlainScalar();
        }
      }
      *parseQuotedScalar() {
        const quote = this.charAt(0);
        let end = this.buffer.indexOf(quote, this.pos + 1);
        if (quote === "'") {
          while (end !== -1 && this.buffer[end + 1] === "'")
            end = this.buffer.indexOf("'", end + 2);
        } else {
          while (end !== -1) {
            let n = 0;
            while (this.buffer[end - 1 - n] === "\\")
              n += 1;
            if (n % 2 === 0)
              break;
            end = this.buffer.indexOf('"', end + 1);
          }
        }
        const qb = this.buffer.substring(0, end);
        let nl = qb.indexOf("\n", this.pos);
        if (nl !== -1) {
          while (nl !== -1) {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = qb.indexOf("\n", cs);
          }
          if (nl !== -1) {
            end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
          }
        }
        if (end === -1) {
          if (!this.atEnd)
            return this.setNext("quoted-scalar");
          end = this.buffer.length;
        }
        yield* this.pushToIndex(end + 1, false);
        return this.flowLevel ? "flow" : "doc";
      }
      *parseBlockScalarHeader() {
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        let i = this.pos;
        while (true) {
          const ch = this.buffer[++i];
          if (ch === "+")
            this.blockScalarKeep = true;
          else if (ch > "0" && ch <= "9")
            this.blockScalarIndent = Number(ch) - 1;
          else if (ch !== "-")
            break;
        }
        return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
      }
      *parseBlockScalar() {
        let nl = this.pos - 1;
        let indent = 0;
        let ch;
        loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
          switch (ch) {
            case " ":
              indent += 1;
              break;
            case "\n":
              nl = i2;
              indent = 0;
              break;
            case "\r": {
              const next = this.buffer[i2 + 1];
              if (!next && !this.atEnd)
                return this.setNext("block-scalar");
              if (next === "\n")
                break;
            }
            // fallthrough
            default:
              break loop;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("block-scalar");
        if (indent >= this.indentNext) {
          if (this.blockScalarIndent === -1)
            this.indentNext = indent;
          else {
            this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
          }
          do {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = this.buffer.indexOf("\n", cs);
          } while (nl !== -1);
          if (nl === -1) {
            if (!this.atEnd)
              return this.setNext("block-scalar");
            nl = this.buffer.length;
          }
        }
        let i = nl + 1;
        ch = this.buffer[i];
        while (ch === " ")
          ch = this.buffer[++i];
        if (ch === "	") {
          while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
            ch = this.buffer[++i];
          nl = i - 1;
        } else if (!this.blockScalarKeep) {
          do {
            let i2 = nl - 1;
            let ch2 = this.buffer[i2];
            if (ch2 === "\r")
              ch2 = this.buffer[--i2];
            const lastChar = i2;
            while (ch2 === " ")
              ch2 = this.buffer[--i2];
            if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
              nl = i2;
            else
              break;
          } while (true);
        }
        yield cst.SCALAR;
        yield* this.pushToIndex(nl + 1, true);
        return yield* this.parseLineStart();
      }
      *parsePlainScalar() {
        const inFlow = this.flowLevel > 0;
        let end = this.pos - 1;
        let i = this.pos - 1;
        let ch;
        while (ch = this.buffer[++i]) {
          if (ch === ":") {
            const next = this.buffer[i + 1];
            if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
              break;
            end = i;
          } else if (isEmpty(ch)) {
            let next = this.buffer[i + 1];
            if (ch === "\r") {
              if (next === "\n") {
                i += 1;
                ch = "\n";
                next = this.buffer[i + 1];
              } else
                end = i;
            }
            if (next === "#" || inFlow && flowIndicatorChars.has(next))
              break;
            if (ch === "\n") {
              const cs = this.continueScalar(i + 1);
              if (cs === -1)
                break;
              i = Math.max(i, cs - 2);
            }
          } else {
            if (inFlow && flowIndicatorChars.has(ch))
              break;
            end = i;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("plain-scalar");
        yield cst.SCALAR;
        yield* this.pushToIndex(end + 1, true);
        return inFlow ? "flow" : "doc";
      }
      *pushCount(n) {
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos += n;
          return n;
        }
        return 0;
      }
      *pushToIndex(i, allowEmpty) {
        const s = this.buffer.slice(this.pos, i);
        if (s) {
          yield s;
          this.pos += s.length;
          return s.length;
        } else if (allowEmpty)
          yield "";
        return 0;
      }
      *pushIndicators() {
        let n = 0;
        loop: while (true) {
          switch (this.charAt(0)) {
            case "!":
              n += yield* this.pushTag();
              n += yield* this.pushSpaces(true);
              continue loop;
            case "&":
              n += yield* this.pushUntil(isNotAnchorChar);
              n += yield* this.pushSpaces(true);
              continue loop;
            case "-":
            // this is an error
            case "?":
            // this is an error outside flow collections
            case ":": {
              const inFlow = this.flowLevel > 0;
              const ch1 = this.charAt(1);
              if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
                if (!inFlow)
                  this.indentNext = this.indentValue + 1;
                else if (this.flowKey)
                  this.flowKey = false;
                n += yield* this.pushCount(1);
                n += yield* this.pushSpaces(true);
                continue loop;
              }
            }
          }
          break loop;
        }
        return n;
      }
      *pushTag() {
        if (this.charAt(1) === "<") {
          let i = this.pos + 2;
          let ch = this.buffer[i];
          while (!isEmpty(ch) && ch !== ">")
            ch = this.buffer[++i];
          return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
        } else {
          let i = this.pos + 1;
          let ch = this.buffer[i];
          while (ch) {
            if (tagChars.has(ch))
              ch = this.buffer[++i];
            else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
              ch = this.buffer[i += 3];
            } else
              break;
          }
          return yield* this.pushToIndex(i, false);
        }
      }
      *pushNewline() {
        const ch = this.buffer[this.pos];
        if (ch === "\n")
          return yield* this.pushCount(1);
        else if (ch === "\r" && this.charAt(1) === "\n")
          return yield* this.pushCount(2);
        else
          return 0;
      }
      *pushSpaces(allowTabs) {
        let i = this.pos - 1;
        let ch;
        do {
          ch = this.buffer[++i];
        } while (ch === " " || allowTabs && ch === "	");
        const n = i - this.pos;
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos = i;
        }
        return n;
      }
      *pushUntil(test) {
        let i = this.pos;
        let ch = this.buffer[i];
        while (!test(ch))
          ch = this.buffer[++i];
        return yield* this.pushToIndex(i, false);
      }
    };
    exports.Lexer = Lexer;
  }
});

// node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS({
  "node_modules/yaml/dist/parse/line-counter.js"(exports) {
    "use strict";
    var LineCounter = class {
      constructor() {
        this.lineStarts = [];
        this.addNewLine = (offset) => this.lineStarts.push(offset);
        this.linePos = (offset) => {
          let low = 0;
          let high = this.lineStarts.length;
          while (low < high) {
            const mid = low + high >> 1;
            if (this.lineStarts[mid] < offset)
              low = mid + 1;
            else
              high = mid;
          }
          if (this.lineStarts[low] === offset)
            return { line: low + 1, col: 1 };
          if (low === 0)
            return { line: 0, col: offset };
          const start = this.lineStarts[low - 1];
          return { line: low, col: offset - start + 1 };
        };
      }
    };
    exports.LineCounter = LineCounter;
  }
});

// node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS({
  "node_modules/yaml/dist/parse/parser.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var cst = require_cst();
    var lexer = require_lexer();
    function includesToken(list, type) {
      for (let i = 0; i < list.length; ++i)
        if (list[i].type === type)
          return true;
      return false;
    }
    function findNonEmptyIndex(list) {
      for (let i = 0; i < list.length; ++i) {
        switch (list[i].type) {
          case "space":
          case "comment":
          case "newline":
            break;
          default:
            return i;
        }
      }
      return -1;
    }
    function isFlowToken(token) {
      switch (token?.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "flow-collection":
          return true;
        default:
          return false;
      }
    }
    function getPrevProps(parent) {
      switch (parent.type) {
        case "document":
          return parent.start;
        case "block-map": {
          const it2 = parent.items[parent.items.length - 1];
          return it2.sep ?? it2.start;
        }
        case "block-seq":
          return parent.items[parent.items.length - 1].start;
        /* istanbul ignore next should not happen */
        default:
          return [];
      }
    }
    function getFirstKeyStartProps(prev) {
      if (prev.length === 0)
        return [];
      let i = prev.length;
      loop: while (--i >= 0) {
        switch (prev[i].type) {
          case "doc-start":
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
          case "newline":
            break loop;
        }
      }
      while (prev[++i]?.type === "space") {
      }
      return prev.splice(i, prev.length);
    }
    function arrayPushArray(target, source) {
      if (source.length < 1e5)
        Array.prototype.push.apply(target, source);
      else
        for (let i = 0; i < source.length; ++i)
          target.push(source[i]);
    }
    function fixFlowSeqItems(fc) {
      if (fc.start.type === "flow-seq-start") {
        for (const it2 of fc.items) {
          if (it2.sep && !it2.value && !includesToken(it2.start, "explicit-key-ind") && !includesToken(it2.sep, "map-value-ind")) {
            if (it2.key)
              it2.value = it2.key;
            delete it2.key;
            if (isFlowToken(it2.value)) {
              if (it2.value.end)
                arrayPushArray(it2.value.end, it2.sep);
              else
                it2.value.end = it2.sep;
            } else
              arrayPushArray(it2.start, it2.sep);
            delete it2.sep;
          }
        }
      }
    }
    var Parser = class {
      /**
       * @param onNewLine - If defined, called separately with the start position of
       *   each new line (in `parse()`, including the start of input).
       */
      constructor(onNewLine) {
        this.atNewLine = true;
        this.atScalar = false;
        this.indent = 0;
        this.offset = 0;
        this.onKeyLine = false;
        this.stack = [];
        this.source = "";
        this.type = "";
        this.lexer = new lexer.Lexer();
        this.onNewLine = onNewLine;
      }
      /**
       * Parse `source` as a YAML stream.
       * If `incomplete`, a part of the last line may be left as a buffer for the next call.
       *
       * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
       *
       * @returns A generator of tokens representing each directive, document, and other structure.
       */
      *parse(source, incomplete = false) {
        if (this.onNewLine && this.offset === 0)
          this.onNewLine(0);
        for (const lexeme of this.lexer.lex(source, incomplete))
          yield* this.next(lexeme);
        if (!incomplete)
          yield* this.end();
      }
      /**
       * Advance the parser by the `source` of one lexical token.
       */
      *next(source) {
        this.source = source;
        if (node_process.env.LOG_TOKENS)
          console.log("|", cst.prettyToken(source));
        if (this.atScalar) {
          this.atScalar = false;
          yield* this.step();
          this.offset += source.length;
          return;
        }
        const type = cst.tokenType(source);
        if (!type) {
          const message = `Not a YAML token: ${source}`;
          yield* this.pop({ type: "error", offset: this.offset, message, source });
          this.offset += source.length;
        } else if (type === "scalar") {
          this.atNewLine = false;
          this.atScalar = true;
          this.type = "scalar";
        } else {
          this.type = type;
          yield* this.step();
          switch (type) {
            case "newline":
              this.atNewLine = true;
              this.indent = 0;
              if (this.onNewLine)
                this.onNewLine(this.offset + source.length);
              break;
            case "space":
              if (this.atNewLine && source[0] === " ")
                this.indent += source.length;
              break;
            case "explicit-key-ind":
            case "map-value-ind":
            case "seq-item-ind":
              if (this.atNewLine)
                this.indent += source.length;
              break;
            case "doc-mode":
            case "flow-error-end":
              return;
            default:
              this.atNewLine = false;
          }
          this.offset += source.length;
        }
      }
      /** Call at end of input to push out any remaining constructions */
      *end() {
        while (this.stack.length > 0)
          yield* this.pop();
      }
      get sourceToken() {
        const st2 = {
          type: this.type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
        return st2;
      }
      *step() {
        const top = this.peek(1);
        if (this.type === "doc-end" && top?.type !== "doc-end") {
          while (this.stack.length > 0)
            yield* this.pop();
          this.stack.push({
            type: "doc-end",
            offset: this.offset,
            source: this.source
          });
          return;
        }
        if (!top)
          return yield* this.stream();
        switch (top.type) {
          case "document":
            return yield* this.document(top);
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return yield* this.scalar(top);
          case "block-scalar":
            return yield* this.blockScalar(top);
          case "block-map":
            return yield* this.blockMap(top);
          case "block-seq":
            return yield* this.blockSequence(top);
          case "flow-collection":
            return yield* this.flowCollection(top);
          case "doc-end":
            return yield* this.documentEnd(top);
        }
        yield* this.pop();
      }
      peek(n) {
        return this.stack[this.stack.length - n];
      }
      *pop(error) {
        const token = error ?? this.stack.pop();
        if (!token) {
          const message = "Tried to pop an empty stack";
          yield { type: "error", offset: this.offset, source: "", message };
        } else if (this.stack.length === 0) {
          yield token;
        } else {
          const top = this.peek(1);
          if (token.type === "block-scalar") {
            token.indent = "indent" in top ? top.indent : 0;
          } else if (token.type === "flow-collection" && top.type === "document") {
            token.indent = 0;
          }
          if (token.type === "flow-collection")
            fixFlowSeqItems(token);
          switch (top.type) {
            case "document":
              top.value = token;
              break;
            case "block-scalar":
              top.props.push(token);
              break;
            case "block-map": {
              const it2 = top.items[top.items.length - 1];
              if (it2.value) {
                top.items.push({ start: [], key: token, sep: [] });
                this.onKeyLine = true;
                return;
              } else if (it2.sep) {
                it2.value = token;
              } else {
                Object.assign(it2, { key: token, sep: [] });
                this.onKeyLine = !it2.explicitKey;
                return;
              }
              break;
            }
            case "block-seq": {
              const it2 = top.items[top.items.length - 1];
              if (it2.value)
                top.items.push({ start: [], value: token });
              else
                it2.value = token;
              break;
            }
            case "flow-collection": {
              const it2 = top.items[top.items.length - 1];
              if (!it2 || it2.value)
                top.items.push({ start: [], key: token, sep: [] });
              else if (it2.sep)
                it2.value = token;
              else
                Object.assign(it2, { key: token, sep: [] });
              return;
            }
            /* istanbul ignore next should not happen */
            default:
              yield* this.pop();
              yield* this.pop(token);
          }
          if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
            const last = token.items[token.items.length - 1];
            if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st2) => st2.type !== "comment" || st2.indent < token.indent))) {
              if (top.type === "document")
                top.end = last.start;
              else
                top.items.push({ start: last.start });
              token.items.splice(-1, 1);
            }
          }
        }
      }
      *stream() {
        switch (this.type) {
          case "directive-line":
            yield { type: "directive", offset: this.offset, source: this.source };
            return;
          case "byte-order-mark":
          case "space":
          case "comment":
          case "newline":
            yield this.sourceToken;
            return;
          case "doc-mode":
          case "doc-start": {
            const doc = {
              type: "document",
              offset: this.offset,
              start: []
            };
            if (this.type === "doc-start")
              doc.start.push(this.sourceToken);
            this.stack.push(doc);
            return;
          }
        }
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML stream`,
          source: this.source
        };
      }
      *document(doc) {
        if (doc.value)
          return yield* this.lineEnd(doc);
        switch (this.type) {
          case "doc-start": {
            if (findNonEmptyIndex(doc.start) !== -1) {
              yield* this.pop();
              yield* this.step();
            } else
              doc.start.push(this.sourceToken);
            return;
          }
          case "anchor":
          case "tag":
          case "space":
          case "comment":
          case "newline":
            doc.start.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(doc);
        if (bv)
          this.stack.push(bv);
        else {
          yield {
            type: "error",
            offset: this.offset,
            message: `Unexpected ${this.type} token in YAML document`,
            source: this.source
          };
        }
      }
      *scalar(scalar) {
        if (this.type === "map-value-ind") {
          const prev = getPrevProps(this.peek(2));
          const start = getFirstKeyStartProps(prev);
          let sep2;
          if (scalar.end) {
            sep2 = scalar.end;
            sep2.push(this.sourceToken);
            delete scalar.end;
          } else
            sep2 = [this.sourceToken];
          const map = {
            type: "block-map",
            offset: scalar.offset,
            indent: scalar.indent,
            items: [{ start, key: scalar, sep: sep2 }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else
          yield* this.lineEnd(scalar);
      }
      *blockScalar(scalar) {
        switch (this.type) {
          case "space":
          case "comment":
          case "newline":
            scalar.props.push(this.sourceToken);
            return;
          case "scalar":
            scalar.source = this.source;
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine) {
              let nl = this.source.indexOf("\n") + 1;
              while (nl !== 0) {
                this.onNewLine(this.offset + nl);
                nl = this.source.indexOf("\n", nl) + 1;
              }
            }
            yield* this.pop();
            break;
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.step();
        }
      }
      *blockMap(map) {
        const it2 = map.items[map.items.length - 1];
        switch (this.type) {
          case "newline":
            this.onKeyLine = false;
            if (it2.value) {
              const end = "end" in it2.value ? it2.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                map.items.push({ start: [this.sourceToken] });
            } else if (it2.sep) {
              it2.sep.push(this.sourceToken);
            } else {
              it2.start.push(this.sourceToken);
            }
            return;
          case "space":
          case "comment":
            if (it2.value) {
              map.items.push({ start: [this.sourceToken] });
            } else if (it2.sep) {
              it2.sep.push(this.sourceToken);
            } else {
              if (this.atIndentedComment(it2.start, map.indent)) {
                const prev = map.items[map.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it2.start);
                  end.push(this.sourceToken);
                  map.items.pop();
                  return;
                }
              }
              it2.start.push(this.sourceToken);
            }
            return;
        }
        if (this.indent >= map.indent) {
          const atMapIndent = !this.onKeyLine && this.indent === map.indent;
          const atNextItem = atMapIndent && (it2.sep || it2.explicitKey) && this.type !== "seq-item-ind";
          let start = [];
          if (atNextItem && it2.sep && !it2.value) {
            const nl = [];
            for (let i = 0; i < it2.sep.length; ++i) {
              const st2 = it2.sep[i];
              switch (st2.type) {
                case "newline":
                  nl.push(i);
                  break;
                case "space":
                  break;
                case "comment":
                  if (st2.indent > map.indent)
                    nl.length = 0;
                  break;
                default:
                  nl.length = 0;
              }
            }
            if (nl.length >= 2)
              start = it2.sep.splice(nl[1]);
          }
          switch (this.type) {
            case "anchor":
            case "tag":
              if (atNextItem || it2.value) {
                start.push(this.sourceToken);
                map.items.push({ start });
                this.onKeyLine = true;
              } else if (it2.sep) {
                it2.sep.push(this.sourceToken);
              } else {
                it2.start.push(this.sourceToken);
              }
              return;
            case "explicit-key-ind":
              if (!it2.sep && !it2.explicitKey) {
                it2.start.push(this.sourceToken);
                it2.explicitKey = true;
              } else if (atNextItem || it2.value) {
                start.push(this.sourceToken);
                map.items.push({ start, explicitKey: true });
              } else {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [this.sourceToken], explicitKey: true }]
                });
              }
              this.onKeyLine = true;
              return;
            case "map-value-ind":
              if (it2.explicitKey) {
                if (!it2.sep) {
                  if (includesToken(it2.start, "newline")) {
                    Object.assign(it2, { key: null, sep: [this.sourceToken] });
                  } else {
                    const start2 = getFirstKeyStartProps(it2.start);
                    this.stack.push({
                      type: "block-map",
                      offset: this.offset,
                      indent: this.indent,
                      items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                    });
                  }
                } else if (it2.value) {
                  map.items.push({ start: [], key: null, sep: [this.sourceToken] });
                } else if (includesToken(it2.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, key: null, sep: [this.sourceToken] }]
                  });
                } else if (isFlowToken(it2.key) && !includesToken(it2.sep, "newline")) {
                  const start2 = getFirstKeyStartProps(it2.start);
                  const key = it2.key;
                  const sep2 = it2.sep;
                  sep2.push(this.sourceToken);
                  delete it2.key;
                  delete it2.sep;
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key, sep: sep2 }]
                  });
                } else if (start.length > 0) {
                  it2.sep = it2.sep.concat(start, this.sourceToken);
                } else {
                  it2.sep.push(this.sourceToken);
                }
              } else {
                if (!it2.sep) {
                  Object.assign(it2, { key: null, sep: [this.sourceToken] });
                } else if (it2.value || atNextItem) {
                  map.items.push({ start, key: null, sep: [this.sourceToken] });
                } else if (includesToken(it2.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: [], key: null, sep: [this.sourceToken] }]
                  });
                } else {
                  it2.sep.push(this.sourceToken);
                }
              }
              this.onKeyLine = true;
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs2 = this.flowScalar(this.type);
              if (atNextItem || it2.value) {
                map.items.push({ start, key: fs2, sep: [] });
                this.onKeyLine = true;
              } else if (it2.sep) {
                this.stack.push(fs2);
              } else {
                Object.assign(it2, { key: fs2, sep: [] });
                this.onKeyLine = true;
              }
              return;
            }
            default: {
              const bv = this.startBlockValue(map);
              if (bv) {
                if (bv.type === "block-seq") {
                  if (!it2.explicitKey && it2.sep && !includesToken(it2.sep, "newline")) {
                    yield* this.pop({
                      type: "error",
                      offset: this.offset,
                      message: "Unexpected block-seq-ind on same line with key",
                      source: this.source
                    });
                    return;
                  }
                } else if (atMapIndent) {
                  map.items.push({ start });
                }
                this.stack.push(bv);
                return;
              }
            }
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *blockSequence(seq) {
        const it2 = seq.items[seq.items.length - 1];
        switch (this.type) {
          case "newline":
            if (it2.value) {
              const end = "end" in it2.value ? it2.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                seq.items.push({ start: [this.sourceToken] });
            } else
              it2.start.push(this.sourceToken);
            return;
          case "space":
          case "comment":
            if (it2.value)
              seq.items.push({ start: [this.sourceToken] });
            else {
              if (this.atIndentedComment(it2.start, seq.indent)) {
                const prev = seq.items[seq.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it2.start);
                  end.push(this.sourceToken);
                  seq.items.pop();
                  return;
                }
              }
              it2.start.push(this.sourceToken);
            }
            return;
          case "anchor":
          case "tag":
            if (it2.value || this.indent <= seq.indent)
              break;
            it2.start.push(this.sourceToken);
            return;
          case "seq-item-ind":
            if (this.indent !== seq.indent)
              break;
            if (it2.value || includesToken(it2.start, "seq-item-ind"))
              seq.items.push({ start: [this.sourceToken] });
            else
              it2.start.push(this.sourceToken);
            return;
        }
        if (this.indent > seq.indent) {
          const bv = this.startBlockValue(seq);
          if (bv) {
            this.stack.push(bv);
            return;
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *flowCollection(fc) {
        const it2 = fc.items[fc.items.length - 1];
        if (this.type === "flow-error-end") {
          let top;
          do {
            yield* this.pop();
            top = this.peek(1);
          } while (top?.type === "flow-collection");
        } else if (fc.end.length === 0) {
          switch (this.type) {
            case "comma":
            case "explicit-key-ind":
              if (!it2 || it2.sep)
                fc.items.push({ start: [this.sourceToken] });
              else
                it2.start.push(this.sourceToken);
              return;
            case "map-value-ind":
              if (!it2 || it2.value)
                fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
              else if (it2.sep)
                it2.sep.push(this.sourceToken);
              else
                Object.assign(it2, { key: null, sep: [this.sourceToken] });
              return;
            case "space":
            case "comment":
            case "newline":
            case "anchor":
            case "tag":
              if (!it2 || it2.value)
                fc.items.push({ start: [this.sourceToken] });
              else if (it2.sep)
                it2.sep.push(this.sourceToken);
              else
                it2.start.push(this.sourceToken);
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs2 = this.flowScalar(this.type);
              if (!it2 || it2.value)
                fc.items.push({ start: [], key: fs2, sep: [] });
              else if (it2.sep)
                this.stack.push(fs2);
              else
                Object.assign(it2, { key: fs2, sep: [] });
              return;
            }
            case "flow-map-end":
            case "flow-seq-end":
              fc.end.push(this.sourceToken);
              return;
          }
          const bv = this.startBlockValue(fc);
          if (bv)
            this.stack.push(bv);
          else {
            yield* this.pop();
            yield* this.step();
          }
        } else {
          const parent = this.peek(2);
          if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
            yield* this.pop();
            yield* this.step();
          } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            fixFlowSeqItems(fc);
            const sep2 = fc.end.splice(1, fc.end.length);
            sep2.push(this.sourceToken);
            const map = {
              type: "block-map",
              offset: fc.offset,
              indent: fc.indent,
              items: [{ start, key: fc, sep: sep2 }]
            };
            this.onKeyLine = true;
            this.stack[this.stack.length - 1] = map;
          } else {
            yield* this.lineEnd(fc);
          }
        }
      }
      flowScalar(type) {
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        return {
          type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
      }
      startBlockValue(parent) {
        switch (this.type) {
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return this.flowScalar(this.type);
          case "block-scalar-header":
            return {
              type: "block-scalar",
              offset: this.offset,
              indent: this.indent,
              props: [this.sourceToken],
              source: ""
            };
          case "flow-map-start":
          case "flow-seq-start":
            return {
              type: "flow-collection",
              offset: this.offset,
              indent: this.indent,
              start: this.sourceToken,
              items: [],
              end: []
            };
          case "seq-item-ind":
            return {
              type: "block-seq",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken] }]
            };
          case "explicit-key-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            start.push(this.sourceToken);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, explicitKey: true }]
            };
          }
          case "map-value-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, key: null, sep: [this.sourceToken] }]
            };
          }
        }
        return null;
      }
      atIndentedComment(start, indent) {
        if (this.type !== "comment")
          return false;
        if (this.indent <= indent)
          return false;
        return start.every((st2) => st2.type === "newline" || st2.type === "space");
      }
      *documentEnd(docEnd) {
        if (this.type !== "doc-mode") {
          if (docEnd.end)
            docEnd.end.push(this.sourceToken);
          else
            docEnd.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
        }
      }
      *lineEnd(token) {
        switch (this.type) {
          case "comma":
          case "doc-start":
          case "doc-end":
          case "flow-seq-end":
          case "flow-map-end":
          case "map-value-ind":
            yield* this.pop();
            yield* this.step();
            break;
          case "newline":
            this.onKeyLine = false;
          // fallthrough
          case "space":
          case "comment":
          default:
            if (token.end)
              token.end.push(this.sourceToken);
            else
              token.end = [this.sourceToken];
            if (this.type === "newline")
              yield* this.pop();
        }
      }
    };
    exports.Parser = Parser;
  }
});

// node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS({
  "node_modules/yaml/dist/public-api.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var errors = require_errors2();
    var log = require_log();
    var identity = require_identity();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    function parseOptions(options) {
      const prettyErrors = options.prettyErrors !== false;
      const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter.LineCounter() || null;
      return { lineCounter: lineCounter$1, prettyErrors };
    }
    function parseAllDocuments(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      const docs = Array.from(composer$1.compose(parser$1.parse(source)));
      if (prettyErrors && lineCounter2)
        for (const doc of docs) {
          doc.errors.forEach(errors.prettifyError(source, lineCounter2));
          doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
        }
      if (docs.length > 0)
        return docs;
      return Object.assign([], { empty: true }, composer$1.streamInfo());
    }
    function parseDocument(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      let doc = null;
      for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
        if (!doc)
          doc = _doc;
        else if (doc.options.logLevel !== "silent") {
          doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
          break;
        }
      }
      if (prettyErrors && lineCounter2) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
      return doc;
    }
    function parse2(src, reviver, options) {
      let _reviver = void 0;
      if (typeof reviver === "function") {
        _reviver = reviver;
      } else if (options === void 0 && reviver && typeof reviver === "object") {
        options = reviver;
      }
      const doc = parseDocument(src, options);
      if (!doc)
        return null;
      doc.warnings.forEach((warning) => log.warn(doc.options.logLevel, warning));
      if (doc.errors.length > 0) {
        if (doc.options.logLevel !== "silent")
          throw doc.errors[0];
        else
          doc.errors = [];
      }
      return doc.toJS(Object.assign({ reviver: _reviver }, options));
    }
    function stringify2(value, replacer, options) {
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
      }
      if (typeof options === "string")
        options = options.length;
      if (typeof options === "number") {
        const indent = Math.round(options);
        options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
      }
      if (value === void 0) {
        const { keepUndefined } = options ?? replacer ?? {};
        if (!keepUndefined)
          return void 0;
      }
      if (identity.isDocument(value) && !_replacer)
        return value.toString(options);
      return new Document.Document(value, _replacer, options).toString(options);
    }
    exports.parse = parse2;
    exports.parseAllDocuments = parseAllDocuments;
    exports.parseDocument = parseDocument;
    exports.stringify = stringify2;
  }
});

// node_modules/yaml/dist/index.js
var require_dist = __commonJS({
  "node_modules/yaml/dist/index.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var Schema = require_Schema();
    var errors = require_errors2();
    var Alias = require_Alias();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var cst = require_cst();
    var lexer = require_lexer();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    var publicApi = require_public_api();
    var visit = require_visit();
    exports.Composer = composer.Composer;
    exports.Document = Document.Document;
    exports.Schema = Schema.Schema;
    exports.YAMLError = errors.YAMLError;
    exports.YAMLParseError = errors.YAMLParseError;
    exports.YAMLWarning = errors.YAMLWarning;
    exports.Alias = Alias.Alias;
    exports.isAlias = identity.isAlias;
    exports.isCollection = identity.isCollection;
    exports.isDocument = identity.isDocument;
    exports.isMap = identity.isMap;
    exports.isNode = identity.isNode;
    exports.isPair = identity.isPair;
    exports.isScalar = identity.isScalar;
    exports.isSeq = identity.isSeq;
    exports.Pair = Pair.Pair;
    exports.Scalar = Scalar.Scalar;
    exports.YAMLMap = YAMLMap.YAMLMap;
    exports.YAMLSeq = YAMLSeq.YAMLSeq;
    exports.CST = cst;
    exports.Lexer = lexer.Lexer;
    exports.LineCounter = lineCounter.LineCounter;
    exports.Parser = parser.Parser;
    exports.parse = publicApi.parse;
    exports.parseAllDocuments = publicApi.parseAllDocuments;
    exports.parseDocument = publicApi.parseDocument;
    exports.stringify = publicApi.stringify;
    exports.visit = visit.visit;
    exports.visitAsync = visit.visitAsync;
  }
});

// node_modules/picocolors/picocolors.js
var require_picocolors = __commonJS({
  "node_modules/picocolors/picocolors.js"(exports, module) {
    var p = process || {};
    var argv = p.argv || [];
    var env = p.env || {};
    var isColorSupported = !(!!env.NO_COLOR || argv.includes("--no-color")) && (!!env.FORCE_COLOR || argv.includes("--color") || p.platform === "win32" || (p.stdout || {}).isTTY && env.TERM !== "dumb" || !!env.CI);
    var formatter = (open3, close, replace = open3) => (input) => {
      let string = "" + input, index = string.indexOf(close, open3.length);
      return ~index ? open3 + replaceClose(string, close, replace, index) + close : open3 + string + close;
    };
    var replaceClose = (string, close, replace, index) => {
      let result = "", cursor = 0;
      do {
        result += string.substring(cursor, index) + replace;
        cursor = index + close.length;
        index = string.indexOf(close, cursor);
      } while (~index);
      return result + string.substring(cursor);
    };
    var createColors = (enabled = isColorSupported) => {
      let f = enabled ? formatter : () => String;
      return {
        isColorSupported: enabled,
        reset: f("\x1B[0m", "\x1B[0m"),
        bold: f("\x1B[1m", "\x1B[22m", "\x1B[22m\x1B[1m"),
        dim: f("\x1B[2m", "\x1B[22m", "\x1B[22m\x1B[2m"),
        italic: f("\x1B[3m", "\x1B[23m"),
        underline: f("\x1B[4m", "\x1B[24m"),
        inverse: f("\x1B[7m", "\x1B[27m"),
        hidden: f("\x1B[8m", "\x1B[28m"),
        strikethrough: f("\x1B[9m", "\x1B[29m"),
        black: f("\x1B[30m", "\x1B[39m"),
        red: f("\x1B[31m", "\x1B[39m"),
        green: f("\x1B[32m", "\x1B[39m"),
        yellow: f("\x1B[33m", "\x1B[39m"),
        blue: f("\x1B[34m", "\x1B[39m"),
        magenta: f("\x1B[35m", "\x1B[39m"),
        cyan: f("\x1B[36m", "\x1B[39m"),
        white: f("\x1B[37m", "\x1B[39m"),
        gray: f("\x1B[90m", "\x1B[39m"),
        bgBlack: f("\x1B[40m", "\x1B[49m"),
        bgRed: f("\x1B[41m", "\x1B[49m"),
        bgGreen: f("\x1B[42m", "\x1B[49m"),
        bgYellow: f("\x1B[43m", "\x1B[49m"),
        bgBlue: f("\x1B[44m", "\x1B[49m"),
        bgMagenta: f("\x1B[45m", "\x1B[49m"),
        bgCyan: f("\x1B[46m", "\x1B[49m"),
        bgWhite: f("\x1B[47m", "\x1B[49m"),
        blackBright: f("\x1B[90m", "\x1B[39m"),
        redBright: f("\x1B[91m", "\x1B[39m"),
        greenBright: f("\x1B[92m", "\x1B[39m"),
        yellowBright: f("\x1B[93m", "\x1B[39m"),
        blueBright: f("\x1B[94m", "\x1B[39m"),
        magentaBright: f("\x1B[95m", "\x1B[39m"),
        cyanBright: f("\x1B[96m", "\x1B[39m"),
        whiteBright: f("\x1B[97m", "\x1B[39m"),
        bgBlackBright: f("\x1B[100m", "\x1B[49m"),
        bgRedBright: f("\x1B[101m", "\x1B[49m"),
        bgGreenBright: f("\x1B[102m", "\x1B[49m"),
        bgYellowBright: f("\x1B[103m", "\x1B[49m"),
        bgBlueBright: f("\x1B[104m", "\x1B[49m"),
        bgMagentaBright: f("\x1B[105m", "\x1B[49m"),
        bgCyanBright: f("\x1B[106m", "\x1B[49m"),
        bgWhiteBright: f("\x1B[107m", "\x1B[49m")
      };
    };
    module.exports = createColors();
    module.exports.createColors = createColors;
  }
});

// node_modules/sisteransi/src/index.js
var require_src = __commonJS({
  "node_modules/sisteransi/src/index.js"(exports, module) {
    "use strict";
    var ESC = "\x1B";
    var CSI = `${ESC}[`;
    var beep = "\x07";
    var cursor = {
      to(x3, y2) {
        if (!y2) return `${CSI}${x3 + 1}G`;
        return `${CSI}${y2 + 1};${x3 + 1}H`;
      },
      move(x3, y2) {
        let ret = "";
        if (x3 < 0) ret += `${CSI}${-x3}D`;
        else if (x3 > 0) ret += `${CSI}${x3}C`;
        if (y2 < 0) ret += `${CSI}${-y2}A`;
        else if (y2 > 0) ret += `${CSI}${y2}B`;
        return ret;
      },
      up: (count = 1) => `${CSI}${count}A`,
      down: (count = 1) => `${CSI}${count}B`,
      forward: (count = 1) => `${CSI}${count}C`,
      backward: (count = 1) => `${CSI}${count}D`,
      nextLine: (count = 1) => `${CSI}E`.repeat(count),
      prevLine: (count = 1) => `${CSI}F`.repeat(count),
      left: `${CSI}G`,
      hide: `${CSI}?25l`,
      show: `${CSI}?25h`,
      save: `${ESC}7`,
      restore: `${ESC}8`
    };
    var scroll = {
      up: (count = 1) => `${CSI}S`.repeat(count),
      down: (count = 1) => `${CSI}T`.repeat(count)
    };
    var erase = {
      screen: `${CSI}2J`,
      up: (count = 1) => `${CSI}1J`.repeat(count),
      down: (count = 1) => `${CSI}J`.repeat(count),
      line: `${CSI}2K`,
      lineEnd: `${CSI}K`,
      lineStart: `${CSI}1K`,
      lines(count) {
        let clear = "";
        for (let i = 0; i < count; i++)
          clear += this.line + (i < count - 1 ? cursor.up() : "");
        if (count)
          clear += cursor.left;
        return clear;
      }
    };
    module.exports = { cursor, scroll, erase, beep };
  }
});

// src/cli.ts
import { resolve as resolve3 } from "node:path";

// src/app-server.ts
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

// src/types.ts
var ALLOWED_MODEL_IDS = ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol"];
var REASONING_EFFORTS = ["low", "medium", "high", "xhigh"];

// src/routing.ts
var MODEL_IDS = ALLOWED_MODEL_IDS;
var APP_SERVER_PROTOCOL_VERSION = "v2";
var ROUTING_POLICY_VERSION = "2026-07-14.skill-first.v1";
var MODEL_COST_MULTIPLIERS = {
  "gpt-5.6-luna": 1,
  "gpt-5.6-terra": 2.5,
  "gpt-5.6-sol": 5
};
var MODEL_COST_PROFILES = {
  "gpt-5.6-luna": {
    multiplier: 1,
    rateVersion: "2026-07-09",
    inputCreditsPerMillion: 25,
    cachedInputCreditsPerMillion: 2.5,
    outputCreditsPerMillion: 150
  },
  "gpt-5.6-terra": {
    multiplier: 2.5,
    rateVersion: "2026-07-09",
    inputCreditsPerMillion: 62.5,
    cachedInputCreditsPerMillion: 6.25,
    outputCreditsPerMillion: 375
  },
  "gpt-5.6-sol": {
    multiplier: 5,
    rateVersion: "2026-07-09",
    inputCreditsPerMillion: 125,
    cachedInputCreditsPerMillion: 12.5,
    outputCreditsPerMillion: 750
  }
};
var EFFORT_ORDER = [...REASONING_EFFORTS];
var STANDARD_ROUTES = {
  plus: {
    discover: { model: "gpt-5.6-terra", effort: "medium" },
    plan: { model: "gpt-5.6-sol", effort: "medium" },
    execute: { model: "gpt-5.6-terra", effort: "high" },
    review: { model: "gpt-5.6-sol", effort: "medium" },
    verify: { model: "gpt-5.6-luna", effort: "medium" },
    debug: { model: "gpt-5.6-sol", effort: "high" }
  },
  pro_5x: {
    discover: { model: "gpt-5.6-terra", effort: "high" },
    plan: { model: "gpt-5.6-sol", effort: "high" },
    execute: { model: "gpt-5.6-terra", effort: "xhigh" },
    review: { model: "gpt-5.6-sol", effort: "high" },
    verify: { model: "gpt-5.6-luna", effort: "medium" },
    debug: { model: "gpt-5.6-sol", effort: "xhigh" }
  },
  pro_20x: {
    discover: { model: "gpt-5.6-sol", effort: "medium" },
    plan: { model: "gpt-5.6-sol", effort: "xhigh" },
    execute: { model: "gpt-5.6-sol", effort: "high" },
    review: { model: "gpt-5.6-sol", effort: "xhigh" },
    verify: { model: "gpt-5.6-terra", effort: "medium" },
    debug: { model: "gpt-5.6-sol", effort: "xhigh" }
  }
};
function classifyQuotaPressure(usedPercent, thresholds = {}) {
  if (usedPercent === void 0 || !Number.isFinite(usedPercent)) return "unknown";
  const warning = thresholds.warningPercent ?? 50;
  const critical = thresholds.criticalPercent ?? 80;
  if (usedPercent >= critical) return "critical";
  if (usedPercent >= warning) return "warning";
  return "normal";
}
function selectFiveHourWindow(rateLimits) {
  return collectQuotaWindows(rateLimits).find((window) => window.windowDurationMins === 300);
}
function selectObservedQuotaWindow(rateLimits) {
  return collectQuotaWindows(rateLimits).filter((window) => window.windowDurationMins !== 300).sort((left, right) => left.windowDurationMins - right.windowDurationMins)[0];
}
function resolveSubscriptionPlan(configPlan, accountPlan) {
  if (configPlan === "plus" || configPlan === "pro_5x" || configPlan === "pro_20x") return configPlan;
  if (accountPlan === "plus") return "plus";
  if (accountPlan === "pro_5x" || accountPlan === "pro_20x") return accountPlan;
  if (accountPlan === "pro") return "pro_5x";
  return "unknown";
}
function resolveSubscriptionMultiplier(plan, override) {
  if (override !== void 0 && Number.isFinite(override) && override > 0) return override;
  if (plan === "pro_20x") return 20;
  if (plan === "pro_5x") return 5;
  return 1;
}
function buildRoutingSnapshot(input, available = true) {
  const account = extractAccount(input.account);
  const accountPlan = typeof account.planType === "string" ? account.planType : void 0;
  const configuredPlan = input.config?.planOverride ?? input.config?.plan;
  const plan = resolveSubscriptionPlan(configuredPlan, accountPlan);
  const window = selectFiveHourWindow(input.rateLimits);
  const observedWindow = window ? void 0 : selectObservedQuotaWindow(input.rateLimits);
  const pressure = classifyQuotaPressure(window?.usedPercent, input.config?.quota);
  const models = normalizeModels(input.models, input.config?.modelAllowlist);
  const warnings = [];
  if (pressure === "unknown") warnings.push("quota_unknown");
  if (available && !window) warnings.push("five_hour_window_unavailable");
  if (models.length === 0) warnings.push("allowed_model_unavailable");
  if (!available && !warnings.includes("quota_unknown")) warnings.push("quota_unknown");
  const snapshot = {
    schemaVersion: 1,
    capturedAt: input.capturedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
    plan,
    account,
    quota: {
      ...window ? {
        windowDurationMins: window.windowDurationMins,
        usedPercent: window.usedPercent,
        ...window.resetsAt !== void 0 ? { resetsAt: window.resetsAt } : {}
      } : {},
      pressure,
      source: available && window ? "app-server" : "unknown",
      ...observedWindow ? { observedWindow } : {}
    },
    models,
    warnings,
    provenance: {
      plan: configuredPlan && configuredPlan !== "auto" ? "config" : accountPlan ? "account/read" : "unknown",
      quota: available && window ? "account/rateLimits/read" : "unknown",
      models: available && models.length ? "model/list" : "unknown"
    },
    subscriptionMultiplier: resolveSubscriptionMultiplier(plan, input.config?.multiplierOverride)
  };
  return { available, snapshot };
}
function createUnavailableRoutingSnapshot(capturedAt = (/* @__PURE__ */ new Date()).toISOString()) {
  return buildRoutingSnapshot({ capturedAt, config: { plan: "auto" } }, false);
}
function chooseRoute(snapshot, task) {
  const warnings = [...snapshot.warnings];
  const pressure = snapshot.quota.pressure;
  const unknownPlan = snapshot.plan === "unknown";
  if (pressure === "unknown" && !warnings.includes("quota_unknown")) warnings.push("quota_unknown");
  if (unknownPlan && !warnings.includes("plan_unknown")) warnings.push("plan_unknown");
  const effectivePlan = effectiveMatrixPlan(snapshot.plan, pressure);
  const base = STANDARD_ROUTES[effectivePlan][task.stage];
  const elevated = task.mode === "critical" || task.risk === "high" || task.risk === "critical" || task.ambiguity === "high" || task.ambiguity === "critical";
  const delta = elevated ? 1 : task.mode === "quick" ? -1 : 0;
  const effort = shiftEffort(base.effort, delta);
  const capability = snapshot.models.find((candidate) => candidate.id === base.model);
  const exactAvailable = capability?.supportedReasoningEfforts.includes(effort) === true;
  const reason = `${task.stage} route for ${effectivePlan} plan under ${pressure} quota`;
  if (!exactAvailable) {
    if (!warnings.includes("required_route_unavailable")) warnings.push("required_route_unavailable");
    return { stage: task.stage, model: null, effort: null, quotaPressure: pressure, reason: `${reason}; exact ${base.model}/${effort} unavailable`, warnings };
  }
  return { stage: task.stage, model: base.model, effort, quotaPressure: pressure, reason, warnings };
}
function effectiveMatrixPlan(plan, pressure) {
  const known = plan === "unknown" ? "plus" : plan;
  if (pressure === "critical" || pressure === "unknown") return "plus";
  if (pressure !== "warning") return known;
  if (known === "pro_20x") return "pro_5x";
  return "plus";
}
function shiftEffort(effort, delta) {
  const index = EFFORT_ORDER.indexOf(effort);
  return EFFORT_ORDER[Math.max(0, Math.min(EFFORT_ORDER.length - 1, index + delta))] ?? effort;
}
function normalizeModels(input, allowlist) {
  const candidates = Array.isArray(input) ? input : isRecord(input) && Array.isArray(input.models) ? input.models : isRecord(input) && Array.isArray(input.data) ? input.data : [];
  const models = [];
  for (const candidate of candidates) {
    if (!isRecord(candidate) || typeof candidate.id !== "string" || !isModelId(candidate.id)) continue;
    if (allowlist && !allowlist.includes(candidate.id)) continue;
    const efforts = Array.isArray(candidate.supportedReasoningEfforts) ? candidate.supportedReasoningEfforts.flatMap((effort) => {
      const value = typeof effort === "string" ? effort : isRecord(effort) && typeof effort.reasoningEffort === "string" ? effort.reasoningEffort : void 0;
      return value && REASONING_EFFORTS.includes(value) ? [value] : [];
    }) : [];
    models.push({ id: candidate.id, supportedReasoningEfforts: efforts });
  }
  return models;
}
function extractAccount(input) {
  if (!isRecord(input)) return {};
  const account = isRecord(input.account) ? input.account : input;
  return typeof account.planType === "string" ? { planType: account.planType } : {};
}
function isModelId(value) {
  return ALLOWED_MODEL_IDS.includes(value);
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function collectQuotaWindows(input, output = [], seen = /* @__PURE__ */ new Set()) {
  if (!isRecord(input) || seen.has(input)) return output;
  seen.add(input);
  if (typeof input.windowDurationMins === "number" && Number.isFinite(input.windowDurationMins) && input.windowDurationMins > 0 && typeof input.usedPercent === "number" && Number.isFinite(input.usedPercent)) {
    output.push({
      windowDurationMins: input.windowDurationMins,
      usedPercent: input.usedPercent,
      ...typeof input.resetsAt === "number" && Number.isFinite(input.resetsAt) ? { resetsAt: input.resetsAt } : {}
    });
  }
  for (const value of Object.values(input)) {
    if (isRecord(value)) collectQuotaWindows(value, output, seen);
  }
  return output;
}

// src/app-server.ts
var AppServerError = class extends Error {
  constructor(message, kind = "unknown", stderr = "") {
    super(message);
    this.kind = kind;
    this.stderr = stderr;
  }
  kind;
  stderr;
};
var AppServerClient = class {
  process;
  pending = /* @__PURE__ */ new Map();
  nextId = 1;
  closed = false;
  stderr = "";
  constructor(options = {}) {
    const args = options.args ?? ["app-server"];
    const spawnOptions = options.cwd ? { cwd: options.cwd, stdio: ["pipe", "pipe", "pipe"] } : { stdio: ["pipe", "pipe", "pipe"] };
    this.process = spawn(options.command ?? "codex", args, spawnOptions);
    const lines = createInterface({ input: this.process.stdout });
    lines.on("line", (line) => this.receive(line));
    this.process.stderr.on("data", (chunk) => {
      if (this.stderr.length >= MAX_STDERR_CHARS) return;
      this.stderr = (this.stderr + String(chunk)).slice(0, MAX_STDERR_CHARS);
    });
    this.process.on("error", (error) => this.fail(new AppServerError(error.message, "spawn", this.stderr)));
    this.process.on("close", () => {
      const kind = looksLikePermissionFailure(this.stderr) ? "permission" : "closed";
      this.fail(new AppServerError("app-server closed before completing request", kind, this.stderr));
    });
  }
  async readSnapshot(config) {
    await this.request("initialize", {
      clientInfo: { name: "codex-dev-flow", title: "Codex Dev Flow", version: "0.1.0" }
    });
    this.notify("initialized", {});
    const account = await this.request("account/read", { refreshToken: false });
    const rateLimits = await this.request("account/rateLimits/read", {});
    const models = await this.request("model/list", { includeHidden: false });
    return buildRoutingSnapshot({ account, rateLimits, models, ...config ? { config } : {} });
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.process.kill();
  }
  notify(method, params) {
    if (this.closed) throw new AppServerError("app-server is closed");
    this.process.stdin.write(JSON.stringify({ method, params }) + "\n");
  }
  request(method, params) {
    if (this.closed) return Promise.reject(new AppServerError("app-server is closed"));
    const id = this.nextId++;
    return new Promise((resolve4, reject) => {
      this.pending.set(id, { resolve: resolve4, reject });
      try {
        this.process.stdin.write(JSON.stringify({ id, method, params }) + "\n");
      } catch (error) {
        this.pending.delete(id);
        reject(error instanceof Error ? error : new AppServerError("failed to write to app-server"));
      }
    });
  }
  receive(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (typeof message.id !== "number") return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.error) {
      pending.reject(new AppServerError(message.error.message ?? "app-server request failed", "rpc"));
      return;
    }
    pending.resolve(message.result);
  }
  fail(error) {
    if (this.closed) return;
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }
};
async function captureRoutingSnapshot(options = {}) {
  const client = new AppServerClient(options);
  const timeoutMs = options.timeoutMs ?? 1500;
  try {
    return await withTimeout(client.readSnapshot(options.config), timeoutMs);
  } catch (error) {
    const failure = classifyAppServerFailure(error);
    return {
      ...createUnavailableRoutingSnapshot(),
      error: failure.code === "app_server_timeout" ? "app-server timeout" : "app-server unavailable",
      failure
    };
  } finally {
    client.close();
  }
}
function withTimeout(promise, timeoutMs) {
  return new Promise((resolve4, reject) => {
    const timer = setTimeout(() => reject(new AppServerError("app-server timeout", "timeout")), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve4(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
var MAX_STDERR_CHARS = 8192;
function classifyAppServerFailure(error) {
  if (error instanceof AppServerError) {
    if (error.kind === "timeout") return { code: "app_server_timeout", retryableWithApproval: false };
    if (error.kind === "spawn") return { code: "app_server_spawn_failed", retryableWithApproval: false };
    if (error.kind === "rpc") return { code: "app_server_rpc_failed", retryableWithApproval: false };
    if (error.kind === "permission" || looksLikePermissionFailure(error.stderr)) {
      return {
        code: "app_server_permission_denied",
        ...mentionsCodexHome(error.stderr) ? { path: "~/.codex" } : {},
        retryableWithApproval: true
      };
    }
    if (error.kind === "closed") return { code: "app_server_closed", retryableWithApproval: false };
  }
  return { code: "app_server_unavailable", retryableWithApproval: false };
}
function looksLikePermissionFailure(value) {
  return /operation not permitted|permission denied|\bEACCES\b|\bEPERM\b/i.test(value);
}
function mentionsCodexHome(value) {
  return /(?:^|[\\/])\.codex(?:[\\/]|\b)/i.test(value);
}

// src/benchmark.ts
import { randomUUID } from "node:crypto";
import { constants, lstatSync, realpathSync } from "node:fs";
import * as fs from "node:fs/promises";
import { basename, join, resolve } from "node:path";
var BENCHMARK_DIRECTORY = join(".codex", "benchmarks");
var ELIGIBLE_OUTCOMES = /* @__PURE__ */ new Set(["finished_local", "finished", "failed"]);
var MAX_COMMENT = 2e3;
var MAX_FILES = 256;
var SECRET = /\b(?:sk-[A-Za-z0-9_-]{8,}|(?:api[_-]?key|token|password|secret)\s*[:=]\s*\S+)\b/gi;
var EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
function shouldOfferBenchmarkSurvey(state) {
  return state.benchmarkEnabled === true && ELIGIBLE_OUTCOMES.has(state.status);
}
function createBenchmarkRecord(input) {
  assertSafeTaskId(input.taskId);
  if (!ELIGIBLE_OUTCOMES.has(input.outcome)) throw new Error("Benchmark survey is available only after finished_local, finished, or failed.");
  const survey = validateSurvey(input.survey);
  const authority = input.mode === "quick" ? input.intakeBrief : input.approvedChangeArtifact;
  if (!authority) throw new Error(input.mode === "quick" ? "Quick benchmark requires Intake Brief authority." : "Standard/Critical benchmark requires approved Change Artifact authority.");
  return {
    schemaVersion: 1,
    taskId: input.taskId,
    recordedAt: normalizeAt(input.recordedAt),
    mode: input.mode,
    outcome: input.outcome,
    authority: input.mode === "quick" ? "intake_brief" : "approved_change_artifact",
    survey,
    deviations: classifyBenchmarkDeviations(authority, input.actual)
  };
}
function classifyBenchmarkDeviations(authority, actual) {
  const planned = new Set((authority.plannedFiles ?? []).map(normalizeSurface).filter(Boolean));
  const created = [...new Set(actual.createdFiles.map(normalizeSurface).filter(Boolean))].slice(0, MAX_FILES);
  const deviations = [];
  for (const file of created) {
    if (authority.forbidNewFiles) deviations.push({ code: "forbidden_new_file", surfaceRef: file });
    else if (planned.size && !planned.has(file)) deviations.push({ code: "unplanned_new_file", surfaceRef: file });
  }
  if (authority.validationRequired && !actual.validationComplete) {
    deviations.push({ code: "missing_validation", surfaceRef: "validation" });
  }
  if (authority.handoffRequired && !actual.handoffComplete) {
    deviations.push({ code: "missing_handoff", surfaceRef: "handoff" });
  }
  return deviations;
}
var BenchmarkStore = class {
  workspaceRoot;
  root;
  constructor(workspaceRoot) {
    try {
      this.workspaceRoot = realpathSync(resolve(workspaceRoot));
      if (!lstatSync(this.workspaceRoot).isDirectory()) throw new Error("not directory");
    } catch {
      throw new Error("Benchmark workspace root must be an existing directory.");
    }
    this.root = resolve(this.workspaceRoot, BENCHMARK_DIRECTORY);
  }
  path(taskId) {
    assertSafeTaskId(taskId);
    return join(this.root, `${taskId}.json`);
  }
  async write(record2) {
    const safeRecord = sanitizeBenchmarkRecord(record2);
    await this.#ensureRoot(true);
    const destination = this.path(safeRecord.taskId);
    const temporary = join(this.root, `.${safeRecord.taskId}.${randomUUID()}.tmp`);
    try {
      const handle = await fs.open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 384);
      try {
        await handle.writeFile(`${JSON.stringify(safeRecord, null, 2)}
`, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      await fs.rename(temporary, destination);
    } finally {
      await fs.unlink(temporary).catch(() => void 0);
    }
  }
  async summary() {
    if (!await this.#ensureRoot(false)) return emptySummary();
    let names;
    try {
      names = await fs.readdir(this.root);
    } catch (error) {
      if (hasCode(error, "ENOENT")) return emptySummary();
      throw error;
    }
    const records = [];
    for (const name of names.sort()) {
      if (!name.endsWith(".json") || basename(name) !== name) continue;
      try {
        const parsed = JSON.parse(await fs.readFile(join(this.root, name), "utf8"));
        records.push(sanitizeBenchmarkRecord(parsed));
      } catch {
      }
    }
    return summarizeBenchmarkRecords(records);
  }
  async #ensureRoot(create) {
    for (const directory of [join(this.workspaceRoot, ".codex"), this.root]) {
      if (create) await fs.mkdir(directory, { mode: 448 }).catch((error) => {
        if (!hasCode(error, "EEXIST")) throw error;
      });
      let metadata;
      try {
        metadata = await fs.lstat(directory);
      } catch (error) {
        if (!create && hasCode(error, "ENOENT")) return false;
        throw error;
      }
      if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
        throw new Error("Benchmark path contains a symlink or non-directory component.");
      }
    }
    if (await fs.realpath(this.root) !== this.root) {
      throw new Error("Benchmark root resolves outside canonical workspace path.");
    }
    return true;
  }
};
function createBenchmarkStore(workspaceRoot) {
  return new BenchmarkStore(workspaceRoot);
}
async function tryWriteBenchmarkRecord(store, record2) {
  if (!record2) return { written: false };
  try {
    await store.write(record2);
    return { written: true };
  } catch {
    return { written: false, error: "benchmark_write_failed" };
  }
}
function summarizeBenchmarkRecords(records) {
  const summary = emptySummary();
  let satisfaction = 0;
  for (const record2 of records) {
    const safeRecord = sanitizeBenchmarkRecord(record2);
    summary.recordCount += 1;
    satisfaction += safeRecord.survey.satisfaction;
    summary.conformance[safeRecord.survey.conformance] += 1;
    summary.pluginValue[safeRecord.survey.pluginValue] += 1;
    summary.outcomes[safeRecord.outcome] += 1;
    for (const deviation of safeRecord.deviations) summary.deviations[deviation.code] += 1;
  }
  summary.satisfactionAverage = summary.recordCount ? Math.round(satisfaction / summary.recordCount * 100) / 100 : null;
  return summary;
}
function emptySummary() {
  return {
    schemaVersion: 1,
    recordCount: 0,
    satisfactionAverage: null,
    conformance: { yes: 0, partial: 0, no: 0 },
    pluginValue: { useful: 0, neutral: 0, counterproductive: 0 },
    deviations: {
      unplanned_new_file: 0,
      forbidden_new_file: 0,
      missing_validation: 0,
      missing_handoff: 0
    },
    outcomes: { finished_local: 0, finished: 0, failed: 0 }
  };
}
function validateSurvey(value) {
  if (!isRecord2(value)) throw new Error("Benchmark survey must be an object.");
  const allowed = /* @__PURE__ */ new Set(["satisfaction", "conformance", "pluginValue", "comment"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new Error("Benchmark survey contains unsupported data.");
  if (![1, 2, 3, 4, 5].includes(value.satisfaction)) throw new Error("Benchmark satisfaction must be 1\u20135.");
  if (!["yes", "partial", "no"].includes(value.conformance)) throw new Error("Benchmark conformance is invalid.");
  if (!["useful", "neutral", "counterproductive"].includes(value.pluginValue)) throw new Error("Benchmark plugin value is invalid.");
  const comment = sanitizeComment(value.comment);
  return {
    satisfaction: value.satisfaction,
    conformance: value.conformance,
    pluginValue: value.pluginValue,
    ...comment ? { comment } : {}
  };
}
function sanitizeBenchmarkRecord(value) {
  validateRecord(value);
  return {
    schemaVersion: 1,
    taskId: value.taskId,
    recordedAt: value.recordedAt,
    mode: value.mode,
    outcome: value.outcome,
    authority: value.authority,
    survey: validateSurvey(value.survey),
    deviations: value.deviations.map((deviation) => ({ ...deviation }))
  };
}
function validateRecord(value) {
  if (!isRecord2(value)) throw new Error("Benchmark record must be an object.");
  const keys = Object.keys(value);
  const allowed = /* @__PURE__ */ new Set(["schemaVersion", "taskId", "recordedAt", "mode", "outcome", "authority", "survey", "deviations"]);
  if (keys.some((key) => !allowed.has(key))) throw new Error("Benchmark record contains unsupported data.");
  if (value.schemaVersion !== 1 || typeof value.taskId !== "string") throw new Error("Benchmark record identity is invalid.");
  assertSafeTaskId(value.taskId);
  if (typeof value.recordedAt !== "string" || Number.isNaN(Date.parse(value.recordedAt))) throw new Error("Benchmark recordedAt is invalid.");
  if (!["quick", "standard", "critical"].includes(value.mode)) throw new Error("Benchmark mode is invalid.");
  if (typeof value.outcome !== "string" || !ELIGIBLE_OUTCOMES.has(value.outcome)) throw new Error("Benchmark outcome is invalid.");
  const expectedAuthority = value.mode === "quick" ? "intake_brief" : "approved_change_artifact";
  if (value.authority !== expectedAuthority) throw new Error("Benchmark authority does not match mode.");
  validateSurvey(value.survey);
  if (!Array.isArray(value.deviations) || value.deviations.length > MAX_FILES + 2) throw new Error("Benchmark deviations are invalid.");
  for (const deviation of value.deviations) {
    if (!isRecord2(deviation) || !["unplanned_new_file", "forbidden_new_file", "missing_validation", "missing_handoff"].includes(deviation.code) || typeof deviation.surfaceRef !== "string" || !deviation.surfaceRef || deviation.surfaceRef.length > 512 || Object.keys(deviation).some((key) => key !== "code" && key !== "surfaceRef")) {
      throw new Error("Benchmark deviation is invalid.");
    }
  }
}
function sanitizeComment(value) {
  if (typeof value !== "string") return "";
  return value.replace(SECRET, "[REDACTED]").replace(EMAIL, "[REDACTED_EMAIL]").replace(/\0/g, "").trim().slice(0, MAX_COMMENT);
}
function normalizeSurface(value) {
  if (typeof value !== "string") return "";
  const safe = value.replace(/\\/g, "/").replace(/^\.\/+/, "").replace(/\0/g, "").trim();
  if (!safe || safe.startsWith("/") || safe.split("/").includes("..")) return "";
  return safe.slice(0, 512);
}
function normalizeAt(value) {
  if (value && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  return (/* @__PURE__ */ new Date()).toISOString();
}
function assertSafeTaskId(taskId) {
  if (!taskId || taskId === "." || taskId === ".." || /[\/\\\0]/.test(taskId)) {
    throw new Error("Benchmark task ID must be one non-traversing path segment.");
  }
}
function hasCode(error, code) {
  return isRecord2(error) && error.code === code;
}
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// src/config.ts
var import__ = __toESM(require__(), 1);
var import_yaml = __toESM(require_dist(), 1);
import { existsSync, readFileSync } from "node:fs";
import { join as join2 } from "node:path";
import { fileURLToPath } from "node:url";

// src/exit-codes.ts
var EXIT_CODES = {
  SUCCESS: 0,
  INVALID_INVOCATION: 2,
  INVALID_CONFIGURATION: 3,
  POLICY_CONTRADICTION: 4,
  STATE_CONFLICT: 5,
  BLOCKED: 6,
  HANDOFF_REQUIRED: 7,
  INTERNAL_ERROR: 10
};

// src/config.ts
var ConfigValidationError = class extends Error {
  constructor(message, source, errors) {
    super(message);
    this.source = source;
    this.errors = errors;
  }
  source;
  errors;
  exitCode = EXIT_CODES.INVALID_CONFIGURATION;
};
var DEFAULT_SUBSCRIPTION_CONFIG = {
  plan: "auto",
  quota: {
    warningPercent: 50,
    criticalPercent: 80,
    unknownPolicy: "conservative"
  },
  modelAllowlist: ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol"],
  modelCosts: MODEL_COST_PROFILES
};
var DEFAULT_CONFIG = {
  schemaVersion: 1,
  finish: { pullRequest: "optional" },
  worktree: { mode: "auto" },
  merge: "never",
  integrations: { plugins: [], skills: [] },
  subscription: DEFAULT_SUBSCRIPTION_CONFIG
};
function validateSchema(name, value) {
  const schema = JSON.parse(readFileSync(fileURLToPath(new URL("../schemas/" + name + ".schema.json", import.meta.url)), "utf8"));
  const ajv2 = new import__.Ajv2020({ allErrors: true, strict: true });
  const validate2 = ajv2.compile(schema);
  const valid = validate2(value);
  return { valid, errors: validate2.errors ? [...validate2.errors] : [] };
}
function validateConfigSource(value, source = "config") {
  const candidate = mergeForValidation(DEFAULT_CONFIG, value);
  const result = validateSchema("config", candidate);
  if (!result.valid) {
    const first = result.errors[0];
    throw new ConfigValidationError(
      `Invalid configuration from ${source} at ${first?.instancePath || "/"}: ${first?.message ?? "schema validation failed"}.`,
      source,
      result.errors
    );
  }
}
function loadConfigSources(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const home = options.home ?? process.env.HOME ?? "";
  const files = [
    { source: "user", path: join2(home, ".codex", "dev-flow.yaml") },
    { source: "repo", path: join2(cwd, ".codex", "dev-flow.yaml") },
    { source: "local", path: join2(cwd, ".codex", "dev-flow.local.yaml") }
  ];
  const sources = [];
  for (const file of files) {
    if (!existsSync(file.path)) continue;
    const parsed = (0, import_yaml.parse)(readFileSync(file.path, "utf8"));
    if (!isRecord3(parsed)) {
      throw new ConfigValidationError(`Invalid configuration from ${file.source}: root must be an object.`, file.source, []);
    }
    sources.push({ source: file.source, value: parsed });
  }
  if (options.flags) sources.push({ source: "flags", value: options.flags });
  return sources;
}
function mergeForValidation(base, incoming) {
  const output = copy(base);
  for (const [key, value] of Object.entries(incoming)) {
    const current = output[key];
    if (isRecord3(current) && isRecord3(value)) output[key] = mergeForValidation(current, value);
    else output[key] = copy(value);
  }
  return output;
}
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function copy(value) {
  if (Array.isArray(value)) return value.map(copy);
  if (isRecord3(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, copy(entry)]));
  return value;
}
function recordLeaves(value, source, provenance, prefix) {
  if (isRecord3(value)) {
    for (const [key, nested] of Object.entries(value)) recordLeaves(nested, source, provenance, prefix ? prefix + "." + key : key);
    return;
  }
  provenance[prefix] = source;
}
function merge(target, incoming, source, provenance, prefix = "") {
  for (const [key, incomingValue] of Object.entries(incoming)) {
    const path = prefix ? prefix + "." + key : key;
    const targetValue = target[key];
    if (isRecord3(targetValue) && isRecord3(incomingValue)) {
      merge(targetValue, incomingValue, source, provenance, path);
      continue;
    }
    target[key] = copy(incomingValue);
    recordLeaves(incomingValue, source, provenance, path);
  }
}
function resolveConfig(sources) {
  const suppliedDefaults = sources.some((source) => source.source === "defaults");
  const ordered = suppliedDefaults ? sources : [{ source: "defaults", value: DEFAULT_CONFIG }, ...sources];
  for (const source of ordered) validateConfigSource(source.value, source.source);
  const value = {};
  const provenance = {};
  for (const source of ordered) merge(value, source.value, source.source, provenance);
  return { value, provenance };
}
function explainConfig(config) {
  return {
    value: copy(config.value),
    provenance: { ...config.provenance }
  };
}

// src/parse.ts
var InvocationError = class extends Error {
  exitCode = EXIT_CODES.INVALID_INVOCATION;
};
var MODES = /* @__PURE__ */ new Set(["quick", "standard", "critical"]);
function invalid(message) {
  throw new InvocationError(message);
}
function parseInvocation(argv) {
  if (argv.length === 0) {
    invalid("An objective or subcommand is required.");
  }
  const [first, ...rest] = argv;
  if (!first) {
    invalid("An objective or subcommand is required.");
  }
  if (first === "init") {
    if (rest.length !== 0) invalid("init accepts no arguments.");
    return { command: "init" };
  }
  if (first === "resume") {
    if (rest.length !== 1 || !rest[0]) invalid("resume requires exactly one task id.");
    return { command: "resume", taskId: rest[0] };
  }
  if (first === "status") {
    if (rest.length > 1) invalid("status accepts at most one task id.");
    return { command: "status", taskId: rest[0] };
  }
  if (first === "benchmark") {
    if (rest.length === 1 && rest[0] === "summary") return { command: "benchmark_summary" };
    invalid("benchmark requires exactly the summary subcommand.");
  }
  if (first === "config") {
    const [subcommand, ...flags] = rest;
    if (subcommand === "show" && (flags.length === 0 || flags.length === 1 && flags[0] === "--explain")) {
      return { command: "config_show", explain: flags[0] === "--explain" };
    }
    if (subcommand === "validate" && (flags.length === 0 || flags.length === 1 && flags[0] === "--json")) {
      return { command: "config_validate", json: flags[0] === "--json" };
    }
    invalid("Invalid config invocation.");
  }
  const benchmark = first === "--benchmark";
  const runArgs = benchmark ? rest : argv;
  const runFirst = runArgs[0];
  const mode = MODES.has(runFirst) ? runFirst : void 0;
  const objectiveParts = mode ? runArgs.slice(1) : runArgs;
  if (objectiveParts.length === 0 || objectiveParts.some((part) => part.startsWith("--"))) {
    invalid("A run requires an objective and no unsupported flags.");
  }
  return { command: "run", mode, objective: objectiveParts.join(" "), flags: benchmark ? { benchmark: true } : {} };
}

// node_modules/@clack/core/dist/index.mjs
var import_picocolors = __toESM(require_picocolors(), 1);
import { stdout as R, stdin as q } from "node:process";
var import_sisteransi = __toESM(require_src(), 1);
import ot from "node:readline";
var at = (t2) => t2 === 161 || t2 === 164 || t2 === 167 || t2 === 168 || t2 === 170 || t2 === 173 || t2 === 174 || t2 >= 176 && t2 <= 180 || t2 >= 182 && t2 <= 186 || t2 >= 188 && t2 <= 191 || t2 === 198 || t2 === 208 || t2 === 215 || t2 === 216 || t2 >= 222 && t2 <= 225 || t2 === 230 || t2 >= 232 && t2 <= 234 || t2 === 236 || t2 === 237 || t2 === 240 || t2 === 242 || t2 === 243 || t2 >= 247 && t2 <= 250 || t2 === 252 || t2 === 254 || t2 === 257 || t2 === 273 || t2 === 275 || t2 === 283 || t2 === 294 || t2 === 295 || t2 === 299 || t2 >= 305 && t2 <= 307 || t2 === 312 || t2 >= 319 && t2 <= 322 || t2 === 324 || t2 >= 328 && t2 <= 331 || t2 === 333 || t2 === 338 || t2 === 339 || t2 === 358 || t2 === 359 || t2 === 363 || t2 === 462 || t2 === 464 || t2 === 466 || t2 === 468 || t2 === 470 || t2 === 472 || t2 === 474 || t2 === 476 || t2 === 593 || t2 === 609 || t2 === 708 || t2 === 711 || t2 >= 713 && t2 <= 715 || t2 === 717 || t2 === 720 || t2 >= 728 && t2 <= 731 || t2 === 733 || t2 === 735 || t2 >= 768 && t2 <= 879 || t2 >= 913 && t2 <= 929 || t2 >= 931 && t2 <= 937 || t2 >= 945 && t2 <= 961 || t2 >= 963 && t2 <= 969 || t2 === 1025 || t2 >= 1040 && t2 <= 1103 || t2 === 1105 || t2 === 8208 || t2 >= 8211 && t2 <= 8214 || t2 === 8216 || t2 === 8217 || t2 === 8220 || t2 === 8221 || t2 >= 8224 && t2 <= 8226 || t2 >= 8228 && t2 <= 8231 || t2 === 8240 || t2 === 8242 || t2 === 8243 || t2 === 8245 || t2 === 8251 || t2 === 8254 || t2 === 8308 || t2 === 8319 || t2 >= 8321 && t2 <= 8324 || t2 === 8364 || t2 === 8451 || t2 === 8453 || t2 === 8457 || t2 === 8467 || t2 === 8470 || t2 === 8481 || t2 === 8482 || t2 === 8486 || t2 === 8491 || t2 === 8531 || t2 === 8532 || t2 >= 8539 && t2 <= 8542 || t2 >= 8544 && t2 <= 8555 || t2 >= 8560 && t2 <= 8569 || t2 === 8585 || t2 >= 8592 && t2 <= 8601 || t2 === 8632 || t2 === 8633 || t2 === 8658 || t2 === 8660 || t2 === 8679 || t2 === 8704 || t2 === 8706 || t2 === 8707 || t2 === 8711 || t2 === 8712 || t2 === 8715 || t2 === 8719 || t2 === 8721 || t2 === 8725 || t2 === 8730 || t2 >= 8733 && t2 <= 8736 || t2 === 8739 || t2 === 8741 || t2 >= 8743 && t2 <= 8748 || t2 === 8750 || t2 >= 8756 && t2 <= 8759 || t2 === 8764 || t2 === 8765 || t2 === 8776 || t2 === 8780 || t2 === 8786 || t2 === 8800 || t2 === 8801 || t2 >= 8804 && t2 <= 8807 || t2 === 8810 || t2 === 8811 || t2 === 8814 || t2 === 8815 || t2 === 8834 || t2 === 8835 || t2 === 8838 || t2 === 8839 || t2 === 8853 || t2 === 8857 || t2 === 8869 || t2 === 8895 || t2 === 8978 || t2 >= 9312 && t2 <= 9449 || t2 >= 9451 && t2 <= 9547 || t2 >= 9552 && t2 <= 9587 || t2 >= 9600 && t2 <= 9615 || t2 >= 9618 && t2 <= 9621 || t2 === 9632 || t2 === 9633 || t2 >= 9635 && t2 <= 9641 || t2 === 9650 || t2 === 9651 || t2 === 9654 || t2 === 9655 || t2 === 9660 || t2 === 9661 || t2 === 9664 || t2 === 9665 || t2 >= 9670 && t2 <= 9672 || t2 === 9675 || t2 >= 9678 && t2 <= 9681 || t2 >= 9698 && t2 <= 9701 || t2 === 9711 || t2 === 9733 || t2 === 9734 || t2 === 9737 || t2 === 9742 || t2 === 9743 || t2 === 9756 || t2 === 9758 || t2 === 9792 || t2 === 9794 || t2 === 9824 || t2 === 9825 || t2 >= 9827 && t2 <= 9829 || t2 >= 9831 && t2 <= 9834 || t2 === 9836 || t2 === 9837 || t2 === 9839 || t2 === 9886 || t2 === 9887 || t2 === 9919 || t2 >= 9926 && t2 <= 9933 || t2 >= 9935 && t2 <= 9939 || t2 >= 9941 && t2 <= 9953 || t2 === 9955 || t2 === 9960 || t2 === 9961 || t2 >= 9963 && t2 <= 9969 || t2 === 9972 || t2 >= 9974 && t2 <= 9977 || t2 === 9979 || t2 === 9980 || t2 === 9982 || t2 === 9983 || t2 === 10045 || t2 >= 10102 && t2 <= 10111 || t2 >= 11094 && t2 <= 11097 || t2 >= 12872 && t2 <= 12879 || t2 >= 57344 && t2 <= 63743 || t2 >= 65024 && t2 <= 65039 || t2 === 65533 || t2 >= 127232 && t2 <= 127242 || t2 >= 127248 && t2 <= 127277 || t2 >= 127280 && t2 <= 127337 || t2 >= 127344 && t2 <= 127373 || t2 === 127375 || t2 === 127376 || t2 >= 127387 && t2 <= 127404 || t2 >= 917760 && t2 <= 917999 || t2 >= 983040 && t2 <= 1048573 || t2 >= 1048576 && t2 <= 1114109;
var lt = (t2) => t2 === 12288 || t2 >= 65281 && t2 <= 65376 || t2 >= 65504 && t2 <= 65510;
var ht = (t2) => t2 >= 4352 && t2 <= 4447 || t2 === 8986 || t2 === 8987 || t2 === 9001 || t2 === 9002 || t2 >= 9193 && t2 <= 9196 || t2 === 9200 || t2 === 9203 || t2 === 9725 || t2 === 9726 || t2 === 9748 || t2 === 9749 || t2 >= 9800 && t2 <= 9811 || t2 === 9855 || t2 === 9875 || t2 === 9889 || t2 === 9898 || t2 === 9899 || t2 === 9917 || t2 === 9918 || t2 === 9924 || t2 === 9925 || t2 === 9934 || t2 === 9940 || t2 === 9962 || t2 === 9970 || t2 === 9971 || t2 === 9973 || t2 === 9978 || t2 === 9981 || t2 === 9989 || t2 === 9994 || t2 === 9995 || t2 === 10024 || t2 === 10060 || t2 === 10062 || t2 >= 10067 && t2 <= 10069 || t2 === 10071 || t2 >= 10133 && t2 <= 10135 || t2 === 10160 || t2 === 10175 || t2 === 11035 || t2 === 11036 || t2 === 11088 || t2 === 11093 || t2 >= 11904 && t2 <= 11929 || t2 >= 11931 && t2 <= 12019 || t2 >= 12032 && t2 <= 12245 || t2 >= 12272 && t2 <= 12287 || t2 >= 12289 && t2 <= 12350 || t2 >= 12353 && t2 <= 12438 || t2 >= 12441 && t2 <= 12543 || t2 >= 12549 && t2 <= 12591 || t2 >= 12593 && t2 <= 12686 || t2 >= 12688 && t2 <= 12771 || t2 >= 12783 && t2 <= 12830 || t2 >= 12832 && t2 <= 12871 || t2 >= 12880 && t2 <= 19903 || t2 >= 19968 && t2 <= 42124 || t2 >= 42128 && t2 <= 42182 || t2 >= 43360 && t2 <= 43388 || t2 >= 44032 && t2 <= 55203 || t2 >= 63744 && t2 <= 64255 || t2 >= 65040 && t2 <= 65049 || t2 >= 65072 && t2 <= 65106 || t2 >= 65108 && t2 <= 65126 || t2 >= 65128 && t2 <= 65131 || t2 >= 94176 && t2 <= 94180 || t2 === 94192 || t2 === 94193 || t2 >= 94208 && t2 <= 100343 || t2 >= 100352 && t2 <= 101589 || t2 >= 101632 && t2 <= 101640 || t2 >= 110576 && t2 <= 110579 || t2 >= 110581 && t2 <= 110587 || t2 === 110589 || t2 === 110590 || t2 >= 110592 && t2 <= 110882 || t2 === 110898 || t2 >= 110928 && t2 <= 110930 || t2 === 110933 || t2 >= 110948 && t2 <= 110951 || t2 >= 110960 && t2 <= 111355 || t2 === 126980 || t2 === 127183 || t2 === 127374 || t2 >= 127377 && t2 <= 127386 || t2 >= 127488 && t2 <= 127490 || t2 >= 127504 && t2 <= 127547 || t2 >= 127552 && t2 <= 127560 || t2 === 127568 || t2 === 127569 || t2 >= 127584 && t2 <= 127589 || t2 >= 127744 && t2 <= 127776 || t2 >= 127789 && t2 <= 127797 || t2 >= 127799 && t2 <= 127868 || t2 >= 127870 && t2 <= 127891 || t2 >= 127904 && t2 <= 127946 || t2 >= 127951 && t2 <= 127955 || t2 >= 127968 && t2 <= 127984 || t2 === 127988 || t2 >= 127992 && t2 <= 128062 || t2 === 128064 || t2 >= 128066 && t2 <= 128252 || t2 >= 128255 && t2 <= 128317 || t2 >= 128331 && t2 <= 128334 || t2 >= 128336 && t2 <= 128359 || t2 === 128378 || t2 === 128405 || t2 === 128406 || t2 === 128420 || t2 >= 128507 && t2 <= 128591 || t2 >= 128640 && t2 <= 128709 || t2 === 128716 || t2 >= 128720 && t2 <= 128722 || t2 >= 128725 && t2 <= 128727 || t2 >= 128732 && t2 <= 128735 || t2 === 128747 || t2 === 128748 || t2 >= 128756 && t2 <= 128764 || t2 >= 128992 && t2 <= 129003 || t2 === 129008 || t2 >= 129292 && t2 <= 129338 || t2 >= 129340 && t2 <= 129349 || t2 >= 129351 && t2 <= 129535 || t2 >= 129648 && t2 <= 129660 || t2 >= 129664 && t2 <= 129672 || t2 >= 129680 && t2 <= 129725 || t2 >= 129727 && t2 <= 129733 || t2 >= 129742 && t2 <= 129755 || t2 >= 129760 && t2 <= 129768 || t2 >= 129776 && t2 <= 129784 || t2 >= 131072 && t2 <= 196605 || t2 >= 196608 && t2 <= 262141;
var O = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/y;
var y = /[\x00-\x08\x0A-\x1F\x7F-\x9F]{1,1000}/y;
var M = /\t{1,1000}/y;
var P = new RegExp("[\\u{1F1E6}-\\u{1F1FF}]{2}|\\u{1F3F4}[\\u{E0061}-\\u{E007A}]{2}[\\u{E0030}-\\u{E0039}\\u{E0061}-\\u{E007A}]{1,3}\\u{E007F}|(?:\\p{Emoji}\\uFE0F\\u20E3?|\\p{Emoji_Modifier_Base}\\p{Emoji_Modifier}?|\\p{Emoji_Presentation})(?:\\u200D(?:\\p{Emoji_Modifier_Base}\\p{Emoji_Modifier}?|\\p{Emoji_Presentation}|\\p{Emoji}\\uFE0F\\u20E3?))*", "yu");
var L = /(?:[\x20-\x7E\xA0-\xFF](?!\uFE0F)){1,1000}/y;
var ct = new RegExp("\\p{M}+", "gu");
var pt = { limit: 1 / 0, ellipsis: "" };
var X = (t2, e = {}, s = {}) => {
  const i = e.limit ?? 1 / 0, r = e.ellipsis ?? "", n = e?.ellipsisWidth ?? (r ? X(r, pt, s).width : 0), u = s.ansiWidth ?? 0, a = s.controlWidth ?? 0, l = s.tabWidth ?? 8, E = s.ambiguousWidth ?? 1, g = s.emojiWidth ?? 2, m = s.fullWidthWidth ?? 2, A = s.regularWidth ?? 1, V = s.wideWidth ?? 2;
  let h2 = 0, o = 0, f = t2.length, v = 0, F = false, d = f, b = Math.max(0, i - n), C = 0, B = 0, c = 0, p = 0;
  t: for (; ; ) {
    if (B > C || o >= f && o > h2) {
      const ut = t2.slice(C, B) || t2.slice(h2, o);
      v = 0;
      for (const Y2 of ut.replaceAll(ct, "")) {
        const $ = Y2.codePointAt(0) || 0;
        if (lt($) ? p = m : ht($) ? p = V : E !== A && at($) ? p = E : p = A, c + p > b && (d = Math.min(d, Math.max(C, h2) + v)), c + p > i) {
          F = true;
          break t;
        }
        v += Y2.length, c += p;
      }
      C = B = 0;
    }
    if (o >= f) break;
    if (L.lastIndex = o, L.test(t2)) {
      if (v = L.lastIndex - o, p = v * A, c + p > b && (d = Math.min(d, o + Math.floor((b - c) / A))), c + p > i) {
        F = true;
        break;
      }
      c += p, C = h2, B = o, o = h2 = L.lastIndex;
      continue;
    }
    if (O.lastIndex = o, O.test(t2)) {
      if (c + u > b && (d = Math.min(d, o)), c + u > i) {
        F = true;
        break;
      }
      c += u, C = h2, B = o, o = h2 = O.lastIndex;
      continue;
    }
    if (y.lastIndex = o, y.test(t2)) {
      if (v = y.lastIndex - o, p = v * a, c + p > b && (d = Math.min(d, o + Math.floor((b - c) / a))), c + p > i) {
        F = true;
        break;
      }
      c += p, C = h2, B = o, o = h2 = y.lastIndex;
      continue;
    }
    if (M.lastIndex = o, M.test(t2)) {
      if (v = M.lastIndex - o, p = v * l, c + p > b && (d = Math.min(d, o + Math.floor((b - c) / l))), c + p > i) {
        F = true;
        break;
      }
      c += p, C = h2, B = o, o = h2 = M.lastIndex;
      continue;
    }
    if (P.lastIndex = o, P.test(t2)) {
      if (c + g > b && (d = Math.min(d, o)), c + g > i) {
        F = true;
        break;
      }
      c += g, C = h2, B = o, o = h2 = P.lastIndex;
      continue;
    }
    o += 1;
  }
  return { width: F ? b : c, index: F ? d : f, truncated: F, ellipsed: F && i >= n };
};
var ft = { limit: 1 / 0, ellipsis: "", ellipsisWidth: 0 };
var S = (t2, e = {}) => X(t2, ft, e).width;
var W = "\x1B";
var Z = "\x9B";
var Ft = 39;
var j = "\x07";
var Q = "[";
var dt = "]";
var tt = "m";
var U = `${dt}8;;`;
var et = new RegExp(`(?:\\${Q}(?<code>\\d+)m|\\${U}(?<uri>.*)${j})`, "y");
var mt = (t2) => {
  if (t2 >= 30 && t2 <= 37 || t2 >= 90 && t2 <= 97) return 39;
  if (t2 >= 40 && t2 <= 47 || t2 >= 100 && t2 <= 107) return 49;
  if (t2 === 1 || t2 === 2) return 22;
  if (t2 === 3) return 23;
  if (t2 === 4) return 24;
  if (t2 === 7) return 27;
  if (t2 === 8) return 28;
  if (t2 === 9) return 29;
  if (t2 === 0) return 0;
};
var st = (t2) => `${W}${Q}${t2}${tt}`;
var it = (t2) => `${W}${U}${t2}${j}`;
var gt = (t2) => t2.map((e) => S(e));
var G = (t2, e, s) => {
  const i = e[Symbol.iterator]();
  let r = false, n = false, u = t2.at(-1), a = u === void 0 ? 0 : S(u), l = i.next(), E = i.next(), g = 0;
  for (; !l.done; ) {
    const m = l.value, A = S(m);
    a + A <= s ? t2[t2.length - 1] += m : (t2.push(m), a = 0), (m === W || m === Z) && (r = true, n = e.startsWith(U, g + 1)), r ? n ? m === j && (r = false, n = false) : m === tt && (r = false) : (a += A, a === s && !E.done && (t2.push(""), a = 0)), l = E, E = i.next(), g += m.length;
  }
  u = t2.at(-1), !a && u !== void 0 && u.length > 0 && t2.length > 1 && (t2[t2.length - 2] += t2.pop());
};
var vt = (t2) => {
  const e = t2.split(" ");
  let s = e.length;
  for (; s > 0 && !(S(e[s - 1]) > 0); ) s--;
  return s === e.length ? t2 : e.slice(0, s).join(" ") + e.slice(s).join("");
};
var Et = (t2, e, s = {}) => {
  if (s.trim !== false && t2.trim() === "") return "";
  let i = "", r, n;
  const u = t2.split(" "), a = gt(u);
  let l = [""];
  for (const [h2, o] of u.entries()) {
    s.trim !== false && (l[l.length - 1] = (l.at(-1) ?? "").trimStart());
    let f = S(l.at(-1) ?? "");
    if (h2 !== 0 && (f >= e && (s.wordWrap === false || s.trim === false) && (l.push(""), f = 0), (f > 0 || s.trim === false) && (l[l.length - 1] += " ", f++)), s.hard && a[h2] > e) {
      const v = e - f, F = 1 + Math.floor((a[h2] - v - 1) / e);
      Math.floor((a[h2] - 1) / e) < F && l.push(""), G(l, o, e);
      continue;
    }
    if (f + a[h2] > e && f > 0 && a[h2] > 0) {
      if (s.wordWrap === false && f < e) {
        G(l, o, e);
        continue;
      }
      l.push("");
    }
    if (f + a[h2] > e && s.wordWrap === false) {
      G(l, o, e);
      continue;
    }
    l[l.length - 1] += o;
  }
  s.trim !== false && (l = l.map((h2) => vt(h2)));
  const E = l.join(`
`), g = E[Symbol.iterator]();
  let m = g.next(), A = g.next(), V = 0;
  for (; !m.done; ) {
    const h2 = m.value, o = A.value;
    if (i += h2, h2 === W || h2 === Z) {
      et.lastIndex = V + 1;
      const F = et.exec(E)?.groups;
      if (F?.code !== void 0) {
        const d = Number.parseFloat(F.code);
        r = d === Ft ? void 0 : d;
      } else F?.uri !== void 0 && (n = F.uri.length === 0 ? void 0 : F.uri);
    }
    const f = r ? mt(r) : void 0;
    o === `
` ? (n && (i += it("")), r && f && (i += st(f))) : h2 === `
` && (r && f && (i += st(r)), n && (i += it(n))), V += h2.length, m = A, A = g.next();
  }
  return i;
};
function K(t2, e, s) {
  return String(t2).normalize().replaceAll(`\r
`, `
`).split(`
`).map((i) => Et(i, e, s)).join(`
`);
}
var At = ["up", "down", "left", "right", "space", "enter", "cancel"];
var _ = { actions: new Set(At), aliases: /* @__PURE__ */ new Map([["k", "up"], ["j", "down"], ["h", "left"], ["l", "right"], ["", "cancel"], ["escape", "cancel"]]), messages: { cancel: "Canceled", error: "Something went wrong" }, withGuide: true };
function H(t2, e) {
  if (typeof t2 == "string") return _.aliases.get(t2) === e;
  for (const s of t2) if (s !== void 0 && H(s, e)) return true;
  return false;
}
function _t(t2, e) {
  if (t2 === e) return;
  const s = t2.split(`
`), i = e.split(`
`), r = Math.max(s.length, i.length), n = [];
  for (let u = 0; u < r; u++) s[u] !== i[u] && n.push(u);
  return { lines: n, numLinesBefore: s.length, numLinesAfter: i.length, numLines: r };
}
var bt = globalThis.process.platform.startsWith("win");
var z = /* @__PURE__ */ Symbol("clack:cancel");
function T(t2, e) {
  const s = t2;
  s.isTTY && s.setRawMode(e);
}
var rt = (t2) => "columns" in t2 && typeof t2.columns == "number" ? t2.columns : 80;
var nt = (t2) => "rows" in t2 && typeof t2.rows == "number" ? t2.rows : 20;
function Bt(t2, e, s, i = s) {
  const r = rt(t2 ?? R);
  return K(e, r - s.length, { hard: true, trim: false }).split(`
`).map((n, u) => `${u === 0 ? i : s}${n}`).join(`
`);
}
var x = class {
  input;
  output;
  _abortSignal;
  rl;
  opts;
  _render;
  _track = false;
  _prevFrame = "";
  _subscribers = /* @__PURE__ */ new Map();
  _cursor = 0;
  state = "initial";
  error = "";
  value;
  userInput = "";
  constructor(e, s = true) {
    const { input: i = q, output: r = R, render: n, signal: u, ...a } = e;
    this.opts = a, this.onKeypress = this.onKeypress.bind(this), this.close = this.close.bind(this), this.render = this.render.bind(this), this._render = n.bind(this), this._track = s, this._abortSignal = u, this.input = i, this.output = r;
  }
  unsubscribe() {
    this._subscribers.clear();
  }
  setSubscriber(e, s) {
    const i = this._subscribers.get(e) ?? [];
    i.push(s), this._subscribers.set(e, i);
  }
  on(e, s) {
    this.setSubscriber(e, { cb: s });
  }
  once(e, s) {
    this.setSubscriber(e, { cb: s, once: true });
  }
  emit(e, ...s) {
    const i = this._subscribers.get(e) ?? [], r = [];
    for (const n of i) n.cb(...s), n.once && r.push(() => i.splice(i.indexOf(n), 1));
    for (const n of r) n();
  }
  prompt() {
    return new Promise((e) => {
      if (this._abortSignal) {
        if (this._abortSignal.aborted) return this.state = "cancel", this.close(), e(z);
        this._abortSignal.addEventListener("abort", () => {
          this.state = "cancel", this.close();
        }, { once: true });
      }
      this.rl = ot.createInterface({ input: this.input, tabSize: 2, prompt: "", escapeCodeTimeout: 50, terminal: true }), this.rl.prompt(), this.opts.initialUserInput !== void 0 && this._setUserInput(this.opts.initialUserInput, true), this.input.on("keypress", this.onKeypress), T(this.input, true), this.output.on("resize", this.render), this.render(), this.once("submit", () => {
        this.output.write(import_sisteransi.cursor.show), this.output.off("resize", this.render), T(this.input, false), e(this.value);
      }), this.once("cancel", () => {
        this.output.write(import_sisteransi.cursor.show), this.output.off("resize", this.render), T(this.input, false), e(z);
      });
    });
  }
  _isActionKey(e, s) {
    return e === "	";
  }
  _setValue(e) {
    this.value = e, this.emit("value", this.value);
  }
  _setUserInput(e, s) {
    this.userInput = e ?? "", this.emit("userInput", this.userInput), s && this._track && this.rl && (this.rl.write(this.userInput), this._cursor = this.rl.cursor);
  }
  _clearUserInput() {
    this.rl?.write(null, { ctrl: true, name: "u" }), this._setUserInput("");
  }
  onKeypress(e, s) {
    if (this._track && s.name !== "return" && (s.name && this._isActionKey(e, s) && this.rl?.write(null, { ctrl: true, name: "h" }), this._cursor = this.rl?.cursor ?? 0, this._setUserInput(this.rl?.line)), this.state === "error" && (this.state = "active"), s?.name && (!this._track && _.aliases.has(s.name) && this.emit("cursor", _.aliases.get(s.name)), _.actions.has(s.name) && this.emit("cursor", s.name)), e && (e.toLowerCase() === "y" || e.toLowerCase() === "n") && this.emit("confirm", e.toLowerCase() === "y"), this.emit("key", e?.toLowerCase(), s), s?.name === "return") {
      if (this.opts.validate) {
        const i = this.opts.validate(this.value);
        i && (this.error = i instanceof Error ? i.message : i, this.state = "error", this.rl?.write(this.userInput));
      }
      this.state !== "error" && (this.state = "submit");
    }
    H([e, s?.name, s?.sequence], "cancel") && (this.state = "cancel"), (this.state === "submit" || this.state === "cancel") && this.emit("finalize"), this.render(), (this.state === "submit" || this.state === "cancel") && this.close();
  }
  close() {
    this.input.unpipe(), this.input.removeListener("keypress", this.onKeypress), this.output.write(`
`), T(this.input, false), this.rl?.close(), this.rl = void 0, this.emit(`${this.state}`, this.value), this.unsubscribe();
  }
  restoreCursor() {
    const e = K(this._prevFrame, process.stdout.columns, { hard: true, trim: false }).split(`
`).length - 1;
    this.output.write(import_sisteransi.cursor.move(-999, e * -1));
  }
  render() {
    const e = K(this._render(this) ?? "", process.stdout.columns, { hard: true, trim: false });
    if (e !== this._prevFrame) {
      if (this.state === "initial") this.output.write(import_sisteransi.cursor.hide);
      else {
        const s = _t(this._prevFrame, e), i = nt(this.output);
        if (this.restoreCursor(), s) {
          const r = Math.max(0, s.numLinesAfter - i), n = Math.max(0, s.numLinesBefore - i);
          let u = s.lines.find((a) => a >= r);
          if (u === void 0) {
            this._prevFrame = e;
            return;
          }
          if (s.lines.length === 1) {
            this.output.write(import_sisteransi.cursor.move(0, u - n)), this.output.write(import_sisteransi.erase.lines(1));
            const a = e.split(`
`);
            this.output.write(a[u]), this._prevFrame = e, this.output.write(import_sisteransi.cursor.move(0, a.length - u - 1));
            return;
          } else if (s.lines.length > 1) {
            if (r < n) u = r;
            else {
              const l = u - n;
              l > 0 && this.output.write(import_sisteransi.cursor.move(0, l));
            }
            this.output.write(import_sisteransi.erase.down());
            const a = e.split(`
`).slice(u);
            this.output.write(a.join(`
`)), this._prevFrame = e;
            return;
          }
        }
        this.output.write(import_sisteransi.erase.down());
      }
      this.output.write(e), this.state === "initial" && (this.state = "active"), this._prevFrame = e;
    }
  }
};
function D(t2, e, s) {
  const i = t2 + e, r = Math.max(s.length - 1, 0), n = i < 0 ? r : i > r ? 0 : i;
  return s[n].disabled ? D(n, e < 0 ? -1 : 1, s) : n;
}
var Wt = class extends x {
  options;
  cursor = 0;
  get _selectedValue() {
    return this.options[this.cursor];
  }
  changeValue() {
    this.value = this._selectedValue.value;
  }
  constructor(e) {
    super(e, false), this.options = e.options;
    const s = this.options.findIndex(({ value: r }) => r === e.initialValue), i = s === -1 ? 0 : s;
    this.cursor = this.options[i].disabled ? D(i, 1, this.options) : i, this.changeValue(), this.on("cursor", (r) => {
      switch (r) {
        case "left":
        case "up":
          this.cursor = D(this.cursor, -1, this.options);
          break;
        case "down":
        case "right":
          this.cursor = D(this.cursor, 1, this.options);
          break;
      }
      this.changeValue();
    });
  }
};
var $t = class extends x {
  get userInputWithCursor() {
    if (this.state === "submit") return this.userInput;
    const e = this.userInput;
    if (this.cursor >= e.length) return `${this.userInput}\u2588`;
    const s = e.slice(0, this.cursor), [i, ...r] = e.slice(this.cursor);
    return `${s}${import_picocolors.default.inverse(i)}${r.join("")}`;
  }
  get cursor() {
    return this._cursor;
  }
  constructor(e) {
    super({ ...e, initialUserInput: e.initialUserInput ?? e.initialValue }), this.on("userInput", (s) => {
      this._setValue(s);
    }), this.on("finalize", () => {
      this.value || (this.value = e.defaultValue), this.value === void 0 && (this.value = "");
    });
  }
};

// node_modules/@clack/prompts/dist/index.mjs
var import_picocolors2 = __toESM(require_picocolors(), 1);
import P2 from "node:process";
var import_sisteransi2 = __toESM(require_src(), 1);
function ht2() {
  return P2.platform !== "win32" ? P2.env.TERM !== "linux" : !!P2.env.CI || !!P2.env.WT_SESSION || !!P2.env.TERMINUS_SUBLIME || P2.env.ConEmuTask === "{cmd::Cmder}" || P2.env.TERM_PROGRAM === "Terminus-Sublime" || P2.env.TERM_PROGRAM === "vscode" || P2.env.TERM === "xterm-256color" || P2.env.TERM === "alacritty" || P2.env.TERMINAL_EMULATOR === "JetBrains-JediTerm";
}
var ee = ht2();
var w2 = (e, r) => ee ? e : r;
var Me = w2("\u25C6", "*");
var ce = w2("\u25A0", "x");
var de = w2("\u25B2", "x");
var k = w2("\u25C7", "o");
var $e = w2("\u250C", "T");
var h = w2("\u2502", "|");
var x2 = w2("\u2514", "\u2014");
var Re = w2("\u2510", "T");
var Oe = w2("\u2518", "\u2014");
var Y = w2("\u25CF", ">");
var K2 = w2("\u25CB", " ");
var te = w2("\u25FB", "[\u2022]");
var G2 = w2("\u25FC", "[+]");
var z2 = w2("\u25FB", "[ ]");
var Pe = w2("\u25AA", "\u2022");
var se = w2("\u2500", "-");
var he = w2("\u256E", "+");
var Ne = w2("\u251C", "+");
var me = w2("\u256F", "+");
var pe = w2("\u2570", "+");
var We = w2("\u256D", "+");
var ge = w2("\u25CF", "\u2022");
var fe = w2("\u25C6", "*");
var Fe = w2("\u25B2", "!");
var ye = w2("\u25A0", "x");
var N2 = (e) => {
  switch (e) {
    case "initial":
    case "active":
      return import_picocolors2.default.cyan(Me);
    case "cancel":
      return import_picocolors2.default.red(ce);
    case "error":
      return import_picocolors2.default.yellow(de);
    case "submit":
      return import_picocolors2.default.green(k);
  }
};
var Ee = (e) => {
  switch (e) {
    case "initial":
    case "active":
      return import_picocolors2.default.cyan(h);
    case "cancel":
      return import_picocolors2.default.red(h);
    case "error":
      return import_picocolors2.default.yellow(h);
    case "submit":
      return import_picocolors2.default.green(h);
  }
};
var mt2 = (e) => e === 161 || e === 164 || e === 167 || e === 168 || e === 170 || e === 173 || e === 174 || e >= 176 && e <= 180 || e >= 182 && e <= 186 || e >= 188 && e <= 191 || e === 198 || e === 208 || e === 215 || e === 216 || e >= 222 && e <= 225 || e === 230 || e >= 232 && e <= 234 || e === 236 || e === 237 || e === 240 || e === 242 || e === 243 || e >= 247 && e <= 250 || e === 252 || e === 254 || e === 257 || e === 273 || e === 275 || e === 283 || e === 294 || e === 295 || e === 299 || e >= 305 && e <= 307 || e === 312 || e >= 319 && e <= 322 || e === 324 || e >= 328 && e <= 331 || e === 333 || e === 338 || e === 339 || e === 358 || e === 359 || e === 363 || e === 462 || e === 464 || e === 466 || e === 468 || e === 470 || e === 472 || e === 474 || e === 476 || e === 593 || e === 609 || e === 708 || e === 711 || e >= 713 && e <= 715 || e === 717 || e === 720 || e >= 728 && e <= 731 || e === 733 || e === 735 || e >= 768 && e <= 879 || e >= 913 && e <= 929 || e >= 931 && e <= 937 || e >= 945 && e <= 961 || e >= 963 && e <= 969 || e === 1025 || e >= 1040 && e <= 1103 || e === 1105 || e === 8208 || e >= 8211 && e <= 8214 || e === 8216 || e === 8217 || e === 8220 || e === 8221 || e >= 8224 && e <= 8226 || e >= 8228 && e <= 8231 || e === 8240 || e === 8242 || e === 8243 || e === 8245 || e === 8251 || e === 8254 || e === 8308 || e === 8319 || e >= 8321 && e <= 8324 || e === 8364 || e === 8451 || e === 8453 || e === 8457 || e === 8467 || e === 8470 || e === 8481 || e === 8482 || e === 8486 || e === 8491 || e === 8531 || e === 8532 || e >= 8539 && e <= 8542 || e >= 8544 && e <= 8555 || e >= 8560 && e <= 8569 || e === 8585 || e >= 8592 && e <= 8601 || e === 8632 || e === 8633 || e === 8658 || e === 8660 || e === 8679 || e === 8704 || e === 8706 || e === 8707 || e === 8711 || e === 8712 || e === 8715 || e === 8719 || e === 8721 || e === 8725 || e === 8730 || e >= 8733 && e <= 8736 || e === 8739 || e === 8741 || e >= 8743 && e <= 8748 || e === 8750 || e >= 8756 && e <= 8759 || e === 8764 || e === 8765 || e === 8776 || e === 8780 || e === 8786 || e === 8800 || e === 8801 || e >= 8804 && e <= 8807 || e === 8810 || e === 8811 || e === 8814 || e === 8815 || e === 8834 || e === 8835 || e === 8838 || e === 8839 || e === 8853 || e === 8857 || e === 8869 || e === 8895 || e === 8978 || e >= 9312 && e <= 9449 || e >= 9451 && e <= 9547 || e >= 9552 && e <= 9587 || e >= 9600 && e <= 9615 || e >= 9618 && e <= 9621 || e === 9632 || e === 9633 || e >= 9635 && e <= 9641 || e === 9650 || e === 9651 || e === 9654 || e === 9655 || e === 9660 || e === 9661 || e === 9664 || e === 9665 || e >= 9670 && e <= 9672 || e === 9675 || e >= 9678 && e <= 9681 || e >= 9698 && e <= 9701 || e === 9711 || e === 9733 || e === 9734 || e === 9737 || e === 9742 || e === 9743 || e === 9756 || e === 9758 || e === 9792 || e === 9794 || e === 9824 || e === 9825 || e >= 9827 && e <= 9829 || e >= 9831 && e <= 9834 || e === 9836 || e === 9837 || e === 9839 || e === 9886 || e === 9887 || e === 9919 || e >= 9926 && e <= 9933 || e >= 9935 && e <= 9939 || e >= 9941 && e <= 9953 || e === 9955 || e === 9960 || e === 9961 || e >= 9963 && e <= 9969 || e === 9972 || e >= 9974 && e <= 9977 || e === 9979 || e === 9980 || e === 9982 || e === 9983 || e === 10045 || e >= 10102 && e <= 10111 || e >= 11094 && e <= 11097 || e >= 12872 && e <= 12879 || e >= 57344 && e <= 63743 || e >= 65024 && e <= 65039 || e === 65533 || e >= 127232 && e <= 127242 || e >= 127248 && e <= 127277 || e >= 127280 && e <= 127337 || e >= 127344 && e <= 127373 || e === 127375 || e === 127376 || e >= 127387 && e <= 127404 || e >= 917760 && e <= 917999 || e >= 983040 && e <= 1048573 || e >= 1048576 && e <= 1114109;
var pt2 = (e) => e === 12288 || e >= 65281 && e <= 65376 || e >= 65504 && e <= 65510;
var gt2 = (e) => e >= 4352 && e <= 4447 || e === 8986 || e === 8987 || e === 9001 || e === 9002 || e >= 9193 && e <= 9196 || e === 9200 || e === 9203 || e === 9725 || e === 9726 || e === 9748 || e === 9749 || e >= 9800 && e <= 9811 || e === 9855 || e === 9875 || e === 9889 || e === 9898 || e === 9899 || e === 9917 || e === 9918 || e === 9924 || e === 9925 || e === 9934 || e === 9940 || e === 9962 || e === 9970 || e === 9971 || e === 9973 || e === 9978 || e === 9981 || e === 9989 || e === 9994 || e === 9995 || e === 10024 || e === 10060 || e === 10062 || e >= 10067 && e <= 10069 || e === 10071 || e >= 10133 && e <= 10135 || e === 10160 || e === 10175 || e === 11035 || e === 11036 || e === 11088 || e === 11093 || e >= 11904 && e <= 11929 || e >= 11931 && e <= 12019 || e >= 12032 && e <= 12245 || e >= 12272 && e <= 12287 || e >= 12289 && e <= 12350 || e >= 12353 && e <= 12438 || e >= 12441 && e <= 12543 || e >= 12549 && e <= 12591 || e >= 12593 && e <= 12686 || e >= 12688 && e <= 12771 || e >= 12783 && e <= 12830 || e >= 12832 && e <= 12871 || e >= 12880 && e <= 19903 || e >= 19968 && e <= 42124 || e >= 42128 && e <= 42182 || e >= 43360 && e <= 43388 || e >= 44032 && e <= 55203 || e >= 63744 && e <= 64255 || e >= 65040 && e <= 65049 || e >= 65072 && e <= 65106 || e >= 65108 && e <= 65126 || e >= 65128 && e <= 65131 || e >= 94176 && e <= 94180 || e === 94192 || e === 94193 || e >= 94208 && e <= 100343 || e >= 100352 && e <= 101589 || e >= 101632 && e <= 101640 || e >= 110576 && e <= 110579 || e >= 110581 && e <= 110587 || e === 110589 || e === 110590 || e >= 110592 && e <= 110882 || e === 110898 || e >= 110928 && e <= 110930 || e === 110933 || e >= 110948 && e <= 110951 || e >= 110960 && e <= 111355 || e === 126980 || e === 127183 || e === 127374 || e >= 127377 && e <= 127386 || e >= 127488 && e <= 127490 || e >= 127504 && e <= 127547 || e >= 127552 && e <= 127560 || e === 127568 || e === 127569 || e >= 127584 && e <= 127589 || e >= 127744 && e <= 127776 || e >= 127789 && e <= 127797 || e >= 127799 && e <= 127868 || e >= 127870 && e <= 127891 || e >= 127904 && e <= 127946 || e >= 127951 && e <= 127955 || e >= 127968 && e <= 127984 || e === 127988 || e >= 127992 && e <= 128062 || e === 128064 || e >= 128066 && e <= 128252 || e >= 128255 && e <= 128317 || e >= 128331 && e <= 128334 || e >= 128336 && e <= 128359 || e === 128378 || e === 128405 || e === 128406 || e === 128420 || e >= 128507 && e <= 128591 || e >= 128640 && e <= 128709 || e === 128716 || e >= 128720 && e <= 128722 || e >= 128725 && e <= 128727 || e >= 128732 && e <= 128735 || e === 128747 || e === 128748 || e >= 128756 && e <= 128764 || e >= 128992 && e <= 129003 || e === 129008 || e >= 129292 && e <= 129338 || e >= 129340 && e <= 129349 || e >= 129351 && e <= 129535 || e >= 129648 && e <= 129660 || e >= 129664 && e <= 129672 || e >= 129680 && e <= 129725 || e >= 129727 && e <= 129733 || e >= 129742 && e <= 129755 || e >= 129760 && e <= 129768 || e >= 129776 && e <= 129784 || e >= 131072 && e <= 196605 || e >= 196608 && e <= 262141;
var ve = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/y;
var re = /[\x00-\x08\x0A-\x1F\x7F-\x9F]{1,1000}/y;
var ie = /\t{1,1000}/y;
var Ae = new RegExp("[\\u{1F1E6}-\\u{1F1FF}]{2}|\\u{1F3F4}[\\u{E0061}-\\u{E007A}]{2}[\\u{E0030}-\\u{E0039}\\u{E0061}-\\u{E007A}]{1,3}\\u{E007F}|(?:\\p{Emoji}\\uFE0F\\u20E3?|\\p{Emoji_Modifier_Base}\\p{Emoji_Modifier}?|\\p{Emoji_Presentation})(?:\\u200D(?:\\p{Emoji_Modifier_Base}\\p{Emoji_Modifier}?|\\p{Emoji_Presentation}|\\p{Emoji}\\uFE0F\\u20E3?))*", "yu");
var ne = /(?:[\x20-\x7E\xA0-\xFF](?!\uFE0F)){1,1000}/y;
var ft2 = new RegExp("\\p{M}+", "gu");
var Ft2 = { limit: 1 / 0, ellipsis: "" };
var Le = (e, r = {}, s = {}) => {
  const i = r.limit ?? 1 / 0, n = r.ellipsis ?? "", o = r?.ellipsisWidth ?? (n ? Le(n, Ft2, s).width : 0), u = s.ansiWidth ?? 0, l = s.controlWidth ?? 0, a = s.tabWidth ?? 8, d = s.ambiguousWidth ?? 1, g = s.emojiWidth ?? 2, E = s.fullWidthWidth ?? 2, p = s.regularWidth ?? 1, y2 = s.wideWidth ?? 2;
  let $ = 0, c = 0, m = e.length, f = 0, F = false, v = m, S2 = Math.max(0, i - o), B = 0, b = 0, A = 0, C = 0;
  e: for (; ; ) {
    if (b > B || c >= m && c > $) {
      const _2 = e.slice(B, b) || e.slice($, c);
      f = 0;
      for (const D2 of _2.replaceAll(ft2, "")) {
        const T2 = D2.codePointAt(0) || 0;
        if (pt2(T2) ? C = E : gt2(T2) ? C = y2 : d !== p && mt2(T2) ? C = d : C = p, A + C > S2 && (v = Math.min(v, Math.max(B, $) + f)), A + C > i) {
          F = true;
          break e;
        }
        f += D2.length, A += C;
      }
      B = b = 0;
    }
    if (c >= m) break;
    if (ne.lastIndex = c, ne.test(e)) {
      if (f = ne.lastIndex - c, C = f * p, A + C > S2 && (v = Math.min(v, c + Math.floor((S2 - A) / p))), A + C > i) {
        F = true;
        break;
      }
      A += C, B = $, b = c, c = $ = ne.lastIndex;
      continue;
    }
    if (ve.lastIndex = c, ve.test(e)) {
      if (A + u > S2 && (v = Math.min(v, c)), A + u > i) {
        F = true;
        break;
      }
      A += u, B = $, b = c, c = $ = ve.lastIndex;
      continue;
    }
    if (re.lastIndex = c, re.test(e)) {
      if (f = re.lastIndex - c, C = f * l, A + C > S2 && (v = Math.min(v, c + Math.floor((S2 - A) / l))), A + C > i) {
        F = true;
        break;
      }
      A += C, B = $, b = c, c = $ = re.lastIndex;
      continue;
    }
    if (ie.lastIndex = c, ie.test(e)) {
      if (f = ie.lastIndex - c, C = f * a, A + C > S2 && (v = Math.min(v, c + Math.floor((S2 - A) / a))), A + C > i) {
        F = true;
        break;
      }
      A += C, B = $, b = c, c = $ = ie.lastIndex;
      continue;
    }
    if (Ae.lastIndex = c, Ae.test(e)) {
      if (A + g > S2 && (v = Math.min(v, c)), A + g > i) {
        F = true;
        break;
      }
      A += g, B = $, b = c, c = $ = Ae.lastIndex;
      continue;
    }
    c += 1;
  }
  return { width: F ? S2 : A, index: F ? v : m, truncated: F, ellipsed: F && i >= o };
};
var yt2 = { limit: 1 / 0, ellipsis: "", ellipsisWidth: 0 };
var M2 = (e, r = {}) => Le(e, yt2, r).width;
var ae = "\x1B";
var je = "\x9B";
var Et2 = 39;
var Ce = "\x07";
var Ve = "[";
var vt2 = "]";
var ke = "m";
var we = `${vt2}8;;`;
var Ge = new RegExp(`(?:\\${Ve}(?<code>\\d+)m|\\${we}(?<uri>.*)${Ce})`, "y");
var At2 = (e) => {
  if (e >= 30 && e <= 37 || e >= 90 && e <= 97) return 39;
  if (e >= 40 && e <= 47 || e >= 100 && e <= 107) return 49;
  if (e === 1 || e === 2) return 22;
  if (e === 3) return 23;
  if (e === 4) return 24;
  if (e === 7) return 27;
  if (e === 8) return 28;
  if (e === 9) return 29;
  if (e === 0) return 0;
};
var He = (e) => `${ae}${Ve}${e}${ke}`;
var Ue = (e) => `${ae}${we}${e}${Ce}`;
var Ct2 = (e) => e.map((r) => M2(r));
var Se = (e, r, s) => {
  const i = r[Symbol.iterator]();
  let n = false, o = false, u = e.at(-1), l = u === void 0 ? 0 : M2(u), a = i.next(), d = i.next(), g = 0;
  for (; !a.done; ) {
    const E = a.value, p = M2(E);
    l + p <= s ? e[e.length - 1] += E : (e.push(E), l = 0), (E === ae || E === je) && (n = true, o = r.startsWith(we, g + 1)), n ? o ? E === Ce && (n = false, o = false) : E === ke && (n = false) : (l += p, l === s && !d.done && (e.push(""), l = 0)), a = d, d = i.next(), g += E.length;
  }
  u = e.at(-1), !l && u !== void 0 && u.length > 0 && e.length > 1 && (e[e.length - 2] += e.pop());
};
var wt = (e) => {
  const r = e.split(" ");
  let s = r.length;
  for (; s > 0 && !(M2(r[s - 1]) > 0); ) s--;
  return s === r.length ? e : r.slice(0, s).join(" ") + r.slice(s).join("");
};
var St = (e, r, s = {}) => {
  if (s.trim !== false && e.trim() === "") return "";
  let i = "", n, o;
  const u = e.split(" "), l = Ct2(u);
  let a = [""];
  for (const [$, c] of u.entries()) {
    s.trim !== false && (a[a.length - 1] = (a.at(-1) ?? "").trimStart());
    let m = M2(a.at(-1) ?? "");
    if ($ !== 0 && (m >= r && (s.wordWrap === false || s.trim === false) && (a.push(""), m = 0), (m > 0 || s.trim === false) && (a[a.length - 1] += " ", m++)), s.hard && l[$] > r) {
      const f = r - m, F = 1 + Math.floor((l[$] - f - 1) / r);
      Math.floor((l[$] - 1) / r) < F && a.push(""), Se(a, c, r);
      continue;
    }
    if (m + l[$] > r && m > 0 && l[$] > 0) {
      if (s.wordWrap === false && m < r) {
        Se(a, c, r);
        continue;
      }
      a.push("");
    }
    if (m + l[$] > r && s.wordWrap === false) {
      Se(a, c, r);
      continue;
    }
    a[a.length - 1] += c;
  }
  s.trim !== false && (a = a.map(($) => wt($)));
  const d = a.join(`
`), g = d[Symbol.iterator]();
  let E = g.next(), p = g.next(), y2 = 0;
  for (; !E.done; ) {
    const $ = E.value, c = p.value;
    if (i += $, $ === ae || $ === je) {
      Ge.lastIndex = y2 + 1;
      const F = Ge.exec(d)?.groups;
      if (F?.code !== void 0) {
        const v = Number.parseFloat(F.code);
        n = v === Et2 ? void 0 : v;
      } else F?.uri !== void 0 && (o = F.uri.length === 0 ? void 0 : F.uri);
    }
    const m = n ? At2(n) : void 0;
    c === `
` ? (o && (i += Ue("")), n && m && (i += He(m))) : $ === `
` && (n && m && (i += He(n)), o && (i += Ue(o))), y2 += $.length, E = p, p = g.next();
  }
  return i;
};
function q2(e, r, s) {
  return String(e).normalize().replaceAll(`\r
`, `
`).split(`
`).map((i) => St(i, r, s)).join(`
`);
}
var It2 = (e, r, s, i, n) => {
  let o = r, u = 0;
  for (let l = s; l < i; l++) {
    const a = e[l];
    if (o = o - a.length, u++, o <= n) break;
  }
  return { lineCount: o, removals: u };
};
var J = (e) => {
  const { cursor: r, options: s, style: i } = e, n = e.output ?? process.stdout, o = rt(n), u = e.columnPadding ?? 0, l = e.rowPadding ?? 4, a = o - u, d = nt(n), g = import_picocolors2.default.dim("..."), E = e.maxItems ?? Number.POSITIVE_INFINITY, p = Math.max(d - l, 0), y2 = Math.max(Math.min(E, p), 5);
  let $ = 0;
  r >= y2 - 3 && ($ = Math.max(Math.min(r - y2 + 3, s.length - y2), 0));
  let c = y2 < s.length && $ > 0, m = y2 < s.length && $ + y2 < s.length;
  const f = Math.min($ + y2, s.length), F = [];
  let v = 0;
  c && v++, m && v++;
  const S2 = $ + (c ? 1 : 0), B = f - (m ? 1 : 0);
  for (let A = S2; A < B; A++) {
    const C = q2(i(s[A], A === r), a, { hard: true, trim: false }).split(`
`);
    F.push(C), v += C.length;
  }
  if (v > p) {
    let A = 0, C = 0, _2 = v;
    const D2 = r - S2, T2 = (W2, I2) => It2(F, _2, W2, I2, p);
    c ? ({ lineCount: _2, removals: A } = T2(0, D2), _2 > p && ({ lineCount: _2, removals: C } = T2(D2 + 1, F.length))) : ({ lineCount: _2, removals: C } = T2(D2 + 1, F.length), _2 > p && ({ lineCount: _2, removals: A } = T2(0, D2))), A > 0 && (c = true, F.splice(0, A)), C > 0 && (m = true, F.splice(F.length - C, C));
  }
  const b = [];
  c && b.push(g);
  for (const A of F) for (const C of A) b.push(C);
  return m && b.push(g), b;
};
var Pt = (e = "", r) => {
  (r?.output ?? process.stdout).write(`${import_picocolors2.default.gray(x2)}  ${import_picocolors2.default.red(e)}

`);
};
var Nt = (e = "", r) => {
  (r?.output ?? process.stdout).write(`${import_picocolors2.default.gray($e)}  ${e}
`);
};
var Wt2 = (e = "", r) => {
  (r?.output ?? process.stdout).write(`${import_picocolors2.default.gray(h)}
${import_picocolors2.default.gray(x2)}  ${e}

`);
};
var jt = (e) => import_picocolors2.default.dim(e);
var Vt2 = (e, r, s) => {
  const i = { hard: true, trim: false }, n = q2(e, r, i).split(`
`), o = n.reduce((a, d) => Math.max(M2(d), a), 0), u = n.map(s).reduce((a, d) => Math.max(M2(d), a), 0), l = r - (u - o);
  return q2(e, l, i);
};
var kt2 = (e = "", r = "", s) => {
  const i = s?.output ?? P2.stdout, n = (s?.withGuide ?? _.withGuide) !== false, o = s?.format ?? jt, u = ["", ...Vt2(e, rt(i) - 6, o).split(`
`).map(o), ""], l = M2(r), a = Math.max(u.reduce((p, y2) => {
    const $ = M2(y2);
    return $ > p ? $ : p;
  }, 0), l) + 2, d = u.map((p) => `${import_picocolors2.default.gray(h)}  ${p}${" ".repeat(a - M2(p))}${import_picocolors2.default.gray(h)}`).join(`
`), g = n ? `${import_picocolors2.default.gray(h)}
` : "", E = n ? Ne : pe;
  i.write(`${g}${import_picocolors2.default.green(k)}  ${import_picocolors2.default.reset(r)} ${import_picocolors2.default.gray(se.repeat(Math.max(a - l - 1, 1)) + he)}
${d}
${import_picocolors2.default.gray(E + se.repeat(a + 2) + me)}
`);
};
var Ut = import_picocolors2.default.magenta;
var Ye = { light: w2("\u2500", "-"), heavy: w2("\u2501", "="), block: w2("\u2588", "#") };
var oe = (e, r) => e.includes(`
`) ? e.split(`
`).map((s) => r(s)).join(`
`) : r(e);
var qt = (e) => {
  const r = (s, i) => {
    const n = s.label ?? String(s.value);
    switch (i) {
      case "disabled":
        return `${import_picocolors2.default.gray(K2)} ${oe(n, import_picocolors2.default.gray)}${s.hint ? ` ${import_picocolors2.default.dim(`(${s.hint ?? "disabled"})`)}` : ""}`;
      case "selected":
        return `${oe(n, import_picocolors2.default.dim)}`;
      case "active":
        return `${import_picocolors2.default.green(Y)} ${n}${s.hint ? ` ${import_picocolors2.default.dim(`(${s.hint})`)}` : ""}`;
      case "cancelled":
        return `${oe(n, (o) => import_picocolors2.default.strikethrough(import_picocolors2.default.dim(o)))}`;
      default:
        return `${import_picocolors2.default.dim(K2)} ${oe(n, import_picocolors2.default.dim)}`;
    }
  };
  return new Wt({ options: e.options, signal: e.signal, input: e.input, output: e.output, initialValue: e.initialValue, render() {
    const s = `${N2(this.state)}  `, i = `${Ee(this.state)}  `, n = Bt(e.output, e.message, i, s), o = `${import_picocolors2.default.gray(h)}
${n}
`;
    switch (this.state) {
      case "submit": {
        const u = `${import_picocolors2.default.gray(h)}  `, l = Bt(e.output, r(this.options[this.cursor], "selected"), u);
        return `${o}${l}`;
      }
      case "cancel": {
        const u = `${import_picocolors2.default.gray(h)}  `, l = Bt(e.output, r(this.options[this.cursor], "cancelled"), u);
        return `${o}${l}
${import_picocolors2.default.gray(h)}`;
      }
      default: {
        const u = `${import_picocolors2.default.cyan(h)}  `, l = o.split(`
`).length;
        return `${o}${u}${J({ output: e.output, cursor: this.cursor, options: this.options, maxItems: e.maxItems, columnPadding: u.length, rowPadding: l + 2, style: (a, d) => r(a, a.disabled ? "disabled" : d ? "active" : "inactive") }).join(`
${u}`)}
${import_picocolors2.default.cyan(x2)}
`;
      }
    }
  } }).prompt();
};
var ze = `${import_picocolors2.default.gray(h)}  `;
var Qt = (e) => new $t({ validate: e.validate, placeholder: e.placeholder, defaultValue: e.defaultValue, initialValue: e.initialValue, output: e.output, signal: e.signal, input: e.input, render() {
  const r = (e?.withGuide ?? _.withGuide) !== false, s = `${`${r ? `${import_picocolors2.default.gray(h)}
` : ""}${N2(this.state)}  `}${e.message}
`, i = e.placeholder ? import_picocolors2.default.inverse(e.placeholder[0]) + import_picocolors2.default.dim(e.placeholder.slice(1)) : import_picocolors2.default.inverse(import_picocolors2.default.hidden("_")), n = this.userInput ? this.userInputWithCursor : i, o = this.value ?? "";
  switch (this.state) {
    case "error": {
      const u = this.error ? `  ${import_picocolors2.default.yellow(this.error)}` : "", l = r ? `${import_picocolors2.default.yellow(h)}  ` : "", a = r ? import_picocolors2.default.yellow(x2) : "";
      return `${s.trim()}
${l}${n}
${a}${u}
`;
    }
    case "submit": {
      const u = o ? `  ${import_picocolors2.default.dim(o)}` : "", l = r ? import_picocolors2.default.gray(h) : "";
      return `${s}${l}${u}`;
    }
    case "cancel": {
      const u = o ? `  ${import_picocolors2.default.strikethrough(import_picocolors2.default.dim(o))}` : "", l = r ? import_picocolors2.default.gray(h) : "";
      return `${s}${l}${u}${o.trim() ? `
${l}` : ""}`;
    }
    default: {
      const u = r ? `${import_picocolors2.default.cyan(h)}  ` : "", l = r ? import_picocolors2.default.cyan(x2) : "";
      return `${s}${u}${n}
${l}
`;
    }
  }
} }).prompt();

// src/init.ts
var import_yaml2 = __toESM(require_dist(), 1);
import { existsSync as existsSync2, readFileSync as readFileSync2 } from "node:fs";
import { mkdir as mkdir2, rename as rename2, unlink as unlink2, writeFile } from "node:fs/promises";
import { join as join3 } from "node:path";
var INTEGRATION_ID = /^[A-Za-z0-9][A-Za-z0-9._/-]*(?::[A-Za-z0-9][A-Za-z0-9._/-]*)?$/;
var ROUTING_TASKS = [
  { stage: "discover", risk: "medium", ambiguity: "medium" },
  { stage: "plan", risk: "medium", ambiguity: "medium" },
  { stage: "execute", risk: "medium", ambiguity: "medium" },
  { stage: "debug", risk: "medium", ambiguity: "medium" },
  { stage: "review", risk: "medium", ambiguity: "medium" },
  { stage: "verify", risk: "medium", ambiguity: "medium" }
];
async function runInit(options = {}) {
  if (!options.prompts && (process.stdin.isTTY !== true || process.stdout.isTTY !== true)) {
    throw new Error("init requires an interactive terminal.");
  }
  const prompts = options.prompts ?? createClackAdapter();
  const cwd = options.cwd ?? process.cwd();
  const directory = join3(cwd, ".codex");
  const path = join3(directory, "dev-flow.yaml");
  const existed = existsSync2(path);
  const current = existed ? readConfiguration(path) : {};
  let draft = draftFromConfiguration(current);
  prompts.intro("Codex Dev Flow \xB7 project setup");
  prompts.note(
    "Configure workflow isolation, subscription-aware routing, quota safeguards, and optional integrations.\nNo model choice is required: Dev Flow assigns models and reasoning automatically.",
    "What this wizard does"
  );
  try {
    draft = await collectWorkflow(prompts, draft);
    draft = await collectSubscription(prompts, draft);
    draft = await collectIntegrations(prompts, draft);
    for (; ; ) {
      const config = buildConfiguration(current, draft);
      validateConfigSource(config, "init");
      prompts.note(renderConfigurationSummary(path, draft), "Configuration summary");
      prompts.note(renderRoutingSummary(draft.plan, "standard", "normal"), `Automatic routing \xB7 ${ROUTING_POLICY_VERSION}`);
      const action = await required(prompts, prompts.select({
        message: existed ? "Review complete. What should Dev Flow do?" : "Configuration ready. What should Dev Flow do?",
        initialValue: "write",
        choices: [
          { value: "write", label: existed ? "Update configuration" : "Create configuration", hint: path },
          { value: "workflow", label: "Edit workflow behavior", hint: "Worktrees and pull requests" },
          { value: "subscription", label: "Edit subscription and quota", hint: "Plan and pressure thresholds" },
          { value: "integrations", label: "Edit integrations", hint: "External plugin and skill allowlists" },
          { value: "cancel", label: "Cancel", hint: "Leave existing files unchanged" }
        ]
      }));
      if (action === "workflow") {
        draft = await collectWorkflow(prompts, draft);
        continue;
      }
      if (action === "subscription") {
        draft = await collectSubscription(prompts, draft);
        continue;
      }
      if (action === "integrations") {
        draft = await collectIntegrations(prompts, draft);
        continue;
      }
      if (action === "cancel") return cancelled(prompts, path);
      const yaml = (0, import_yaml2.stringify)(config, { lineWidth: 0 });
      await mkdir2(directory, { recursive: true });
      const temporaryPath = `${path}.tmp-${process.pid}-${Date.now()}`;
      try {
        await writeFile(temporaryPath, yaml, { encoding: "utf8", mode: 384 });
        await rename2(temporaryPath, path);
      } catch (error) {
        await unlink2(temporaryPath).catch(() => void 0);
        throw error;
      }
      prompts.outro(`Configuration ${existed ? "updated" : "created"}: ${path}`);
      return { command: "init", status: existed ? "updated" : "created", data: { path, config } };
    }
  } catch (error) {
    if (error instanceof InitCancelledError) return cancelled(prompts, path);
    throw error;
  }
}
function buildRoutingPreview(plan, mode = "standard", pressure = "normal") {
  const resolvedPlan = plan === "auto" ? "unknown" : plan;
  const models = ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol"].map((id) => ({
    id,
    supportedReasoningEfforts: [...REASONING_EFFORTS]
  }));
  return ROUTING_TASKS.map((task) => chooseRoute({
    schemaVersion: 1,
    capturedAt: "preview",
    plan: resolvedPlan,
    account: {},
    quota: { pressure, source: "unknown" },
    models,
    warnings: [],
    provenance: { plan: plan === "auto" ? "unknown" : "config", quota: "unknown", models: "model/list" }
  }, { ...task, mode }));
}
async function collectWorkflow(prompts, draft) {
  prompts.note("Choose how Dev Flow isolates changes and whether completion requires a pull request.", "1/3 \xB7 Workflow behavior");
  const worktreeMode = await required(prompts, prompts.select({
    message: "How should isolated Git worktrees be used?",
    initialValue: draft.worktreeMode,
    choices: [
      { value: "auto", label: "Automatic (recommended)", hint: "Require isolation only when workflow risk needs it" },
      { value: "required", label: "Always required", hint: "Every applicable change runs in an isolated worktree" }
    ]
  }));
  const pullRequest = await required(prompts, prompts.select({
    message: "Must a pull request be created before completion?",
    initialValue: draft.pullRequest,
    choices: [
      { value: "optional", label: "Optional", hint: "Local verified handoff is allowed" },
      { value: "required", label: "Required", hint: "Workflow cannot finish without a pull request" }
    ]
  }));
  return { ...draft, worktreeMode, pullRequest };
}
async function collectSubscription(prompts, draft) {
  prompts.note("Your plan controls available routing depth. Dev Flow still chooses each model by skill, workflow risk, and initial quota pressure.", "2/3 \xB7 Subscription and quota");
  const plan = await required(prompts, prompts.select({
    message: "Which Codex subscription capacity should this project use?",
    initialValue: draft.plan,
    choices: [
      { value: "auto", label: "Detect automatically (recommended)", hint: "Read account plan once at workflow start; unknown uses Plus baseline" },
      { value: "plus", label: "Codex Plus", hint: "1x capacity \xB7 conservative routing depth" },
      { value: "pro_5x", label: "Codex Pro 5x", hint: "5x capacity \xB7 deeper reasoning on high-leverage skills" },
      { value: "pro_20x", label: "Codex Pro 20x", hint: "20x capacity \xB7 deepest default routing" }
    ]
  }));
  let warningPercent = draft.warningPercent;
  let criticalPercent = draft.criticalPercent;
  for (; ; ) {
    warningPercent = await numberPrompt(prompts, "When should quota pressure become a warning?", warningPercent, "Example: 50 means 50% of the five-hour window used");
    criticalPercent = await numberPrompt(prompts, "When should quota pressure become critical?", criticalPercent, "Example: 80 means 80% of the five-hour window used");
    if (warningPercent < criticalPercent) break;
    prompts.note("Warning threshold must be lower than critical threshold. Please enter both values again.", "Invalid quota thresholds");
  }
  return { ...draft, plan, warningPercent, criticalPercent };
}
async function collectIntegrations(prompts, draft) {
  prompts.note("Optional allowlists restrict external capabilities Dev Flow may use. Leave empty for none.\nExamples: impeccable, context-mode:ctx-search", "3/3 \xB7 External integrations");
  const plugins = await idsPrompt(prompts, "Allowed external plugin IDs", draft.plugins, "impeccable, context-mode");
  const skills = await idsPrompt(prompts, "Allowed external skill IDs", draft.skills, "impeccable:frontend-design");
  return { ...draft, plugins, skills };
}
function buildConfiguration(current, draft) {
  const worktree = record(current.worktree);
  const finish = record(current.finish);
  const subscription = record(current.subscription);
  const quota = record(subscription.quota);
  const integrations = record(current.integrations);
  return {
    ...current,
    schemaVersion: 1,
    worktree: { ...worktree, mode: draft.worktreeMode },
    finish: { ...finish, pullRequest: draft.pullRequest },
    merge: "never",
    subscription: {
      ...subscription,
      plan: draft.plan,
      quota: { ...quota, warningPercent: draft.warningPercent, criticalPercent: draft.criticalPercent, unknownPolicy: "conservative" }
    },
    integrations: { ...integrations, plugins: draft.plugins, skills: draft.skills }
  };
}
function draftFromConfiguration(current) {
  const worktree = record(current.worktree);
  const finish = record(current.finish);
  const subscription = record(current.subscription);
  const quota = record(subscription.quota);
  const integrations = record(current.integrations);
  return {
    worktreeMode: choiceValue(worktree.mode, ["auto", "required"], "auto"),
    pullRequest: choiceValue(finish.pullRequest, ["optional", "required"], "optional"),
    plan: choiceValue(subscription.plan, ["auto", "plus", "pro_5x", "pro_20x"], "auto"),
    warningPercent: numberValue(quota.warningPercent, 50),
    criticalPercent: numberValue(quota.criticalPercent, 80),
    plugins: stringArray(integrations.plugins),
    skills: stringArray(integrations.skills)
  };
}
function renderConfigurationSummary(path, draft) {
  return [
    `Target: ${path}`,
    `Worktrees: ${draft.worktreeMode}`,
    `Pull requests: ${draft.pullRequest}`,
    `Subscription: ${draft.plan === "auto" ? "automatic (Plus if unknown)" : draft.plan}`,
    `Quota pressure: warning ${draft.warningPercent}% \xB7 critical ${draft.criticalPercent}%`,
    `Plugins: ${draft.plugins.join(", ") || "none"}`,
    `Skills: ${draft.skills.join(", ") || "none"}`,
    `Model costs: Luna ${MODEL_COST_MULTIPLIERS["gpt-5.6-luna"]}x \xB7 Terra ${MODEL_COST_MULTIPLIERS["gpt-5.6-terra"]}x \xB7 Sol ${MODEL_COST_MULTIPLIERS["gpt-5.6-sol"]}x`
  ].join("\n");
}
function renderRoutingSummary(plan, mode, pressure) {
  const labels = { discover: "Discover", plan: "Plan", execute: "Execute", review: "Review", verify: "Verify", debug: "Debug root cause" };
  const routes = buildRoutingPreview(plan, mode, pressure).map(
    (decision) => `${labels[decision.stage]}: ${decision.model ?? "unavailable"} \xB7 ${decision.effort ?? "unavailable"}`
  );
  return [
    `Baseline: ${plan === "auto" ? "Plus until account detection" : plan} \xB7 ${mode} \xB7 ${pressure} quota`,
    ...routes,
    "Live availability is captured once when a Dev Flow workflow starts; exact unavailable routes block instead of falling back."
  ].join("\n");
}
async function numberPrompt(prompts, message, fallback, placeholder) {
  const answer = await required(prompts, prompts.text({
    message,
    defaultValue: String(fallback),
    placeholder,
    validate: (value) => {
      const number = Number(value);
      return Number.isFinite(number) && number >= 0 && number <= 100 ? void 0 : "Enter a number from 0 to 100.";
    }
  }));
  return Number(answer);
}
async function idsPrompt(prompts, message, fallback, placeholder) {
  const answer = await required(prompts, prompts.text({
    message,
    defaultValue: fallback.join(", "),
    placeholder,
    validate: (value) => {
      const invalid3 = parseIds(value).find((id) => !INTEGRATION_ID.test(id));
      return invalid3 ? `Invalid integration identifier: ${invalid3}` : void 0;
    }
  }));
  return parseIds(answer);
}
function parseIds(value) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}
async function required(prompts, answer) {
  const value = await answer;
  if (typeof value === "symbol") throw new InitCancelledError();
  return value;
}
function cancelled(prompts, path) {
  prompts.cancel("Initialization cancelled. No files changed.");
  return { command: "init", status: "cancelled", data: { path } };
}
function createClackAdapter() {
  return {
    intro: Nt,
    outro: Wt2,
    note: kt2,
    cancel: Pt,
    select: (options) => {
      const choices = options.choices.map((choice) => ({
        value: choice.value,
        label: choice.label,
        ...choice.hint ? { hint: choice.hint } : {}
      }));
      return qt({ message: options.message, options: choices, initialValue: options.initialValue });
    },
    text: (options) => Qt({
      message: options.message,
      ...options.placeholder !== void 0 ? { placeholder: options.placeholder } : {},
      ...options.defaultValue !== void 0 ? { defaultValue: options.defaultValue } : {},
      ...options.validate ? { validate: (value) => options.validate?.(value ?? "") } : {}
    })
  };
}
function readConfiguration(path) {
  const parsed = (0, import_yaml2.parse)(readFileSync2(path, "utf8"));
  if (!isRecord4(parsed)) throw new Error(`Invalid configuration at ${path}: root must be an object.`);
  return parsed;
}
function record(value) {
  return isRecord4(value) ? value : {};
}
function choiceValue(value, values, fallback) {
  return typeof value === "string" && values.includes(value) ? value : fallback;
}
function numberValue(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
function isRecord4(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
var InitCancelledError = class extends Error {
};

// src/quota-cache.ts
import { randomUUID as randomUUID2 } from "node:crypto";
import { mkdir as mkdir3, readFile as readFile2, rename as rename3, rm, writeFile as writeFile2 } from "node:fs/promises";
import { dirname } from "node:path";
var FIVE_HOURS_SECONDS = 300 * 60;
async function readFiveHourResetCache(path, nowEpochSeconds) {
  try {
    const parsed = JSON.parse(await readFile2(path, "utf8"));
    if (!isFiveHourResetCache(parsed) || parsed.resetsAt <= nowEpochSeconds || parsed.resetsAt > nowEpochSeconds + FIVE_HOURS_SECONDS) return void 0;
    return parsed;
  } catch {
    return void 0;
  }
}
async function writeFiveHourResetCache(path, value) {
  if (value.windowDurationMins !== 300 || !Number.isFinite(value.resetsAt)) {
    throw new Error("Invalid five-hour reset cache value.");
  }
  const cache = { schemaVersion: 1, ...value };
  const temporaryPath = path + "." + process.pid + "." + randomUUID2() + ".tmp";
  await mkdir3(dirname(path), { recursive: true, mode: 448 });
  try {
    await writeFile2(temporaryPath, JSON.stringify(cache, null, 2) + "\n", { encoding: "utf8", mode: 384 });
    await rename3(temporaryPath, path);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => void 0);
    throw error;
  }
}
function applyFiveHourResetFallback(snapshot, cached) {
  if (!cached || snapshot.quota.source === "app-server") return snapshot;
  return {
    ...snapshot,
    quota: {
      windowDurationMins: 300,
      resetsAt: cached.resetsAt,
      pressure: "unknown",
      source: "last-known",
      ...snapshot.quota.observedWindow ? { observedWindow: snapshot.quota.observedWindow } : {}
    },
    warnings: snapshot.warnings.includes("quota_fallback_last_known") ? snapshot.warnings : [...snapshot.warnings, "quota_fallback_last_known"],
    provenance: { ...snapshot.provenance, quota: "last-known-cache" }
  };
}
function isFiveHourResetCache(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value;
  return candidate.schemaVersion === 1 && candidate.windowDurationMins === 300 && typeof candidate.resetsAt === "number" && Number.isFinite(candidate.resetsAt);
}

// src/state-machine.ts
var MACRO_PHASES = Object.freeze(["INTAKE", "SHAPE", "GATE", "BUILD", "ASSURE", "HANDOFF"]);
var GUARD_IDS = Object.freeze([
  "task_initialized",
  "effective_constraints_valid",
  "mode_confirmed",
  "intake_complete",
  "intake_reopened",
  "routing_ready",
  "quick_scope_bounded",
  "critical_workspace_ready",
  "discovery_sufficient",
  "contract_complete",
  "approval_current",
  "task_authorized",
  "validation_fresh",
  "review_satisfied",
  "verification_complete",
  "correction_budget_available",
  "resume_metadata_valid",
  "resume_reconciled",
  "terminal_source_recorded",
  "gate_context_valid",
  "handoff_intent_resolved",
  "handoff_reconciled",
  "critical_completion_approved"
]);
var CAPSULE = {
  INTAKE: {
    consumes: ["request", "constraints"],
    produces: ["intake.brief", "intake.decisions", "intake.question", "classification", "routing", "workspace", "freshness.config", "freshness.policy"],
    invalidates: ["intake.dependent-decisions", "classification", "routing", "workspace", "approvals"]
  },
  SHAPE: {
    consumes: ["intake.brief", "intake.decisions", "intake.technical-unknowns", "constraints", "classification", "routing", "workspace"],
    produces: ["discovery", "contract", "freshness.git", "freshness.artifact"],
    invalidates: ["discovery", "contract", "approvals", "build", "assurance", "handoff"]
  },
  GATE: {
    consumes: ["contract", "classification", "assurance.verificationEvidence"],
    produces: ["approvals"],
    invalidates: ["approvals"]
  },
  BUILD: {
    consumes: ["contract", "approvals", "discovery", "workspace", "freshness"],
    produces: ["build", "issues.active", "freshness.git", "freshness.commands"],
    invalidates: ["build.validationEvidence", "assurance", "handoff.receipts", "approvals"]
  },
  ASSURE: {
    consumes: ["contract", "build", "issues.active", "freshness"],
    produces: ["assurance", "issues.active", "freshness.commands"],
    invalidates: ["assurance.findings", "assurance.verificationEvidence", "handoff.receipts", "approvals"]
  },
  HANDOFF: {
    consumes: ["contract", "assurance.verificationEvidence", "workspace", "handoff"],
    produces: ["handoff.identities", "handoff.receipts"],
    invalidates: ["handoff.receipts"]
  }
};
var EVENTS = {
  INTAKE: ["task.initialized", "intake.question_recorded", "intake.answer_recorded", "intake.checkpoint", "advance.rejected", "intake.reopened", "mode.proposed", "mode.confirmed", "routing.captured", "state.transition"],
  SHAPE: ["discovery.updated", "contract.projected", "evidence.invalidated", "state.transition"],
  GATE: ["approval.requested", "approval.recorded", "approval.invalidated", "state.transition"],
  BUILD: ["task.started", "checkpoint.recorded", "validation.completed", "finding.observed", "state.transition"],
  ASSURE: ["review.completed", "finding.observed", "finding.resolved", "verification.completed", "state.transition"],
  HANDOFF: ["handoff.reconciled", "handoff.attempted", "handoff.receipt_recorded", "task.finished", "state.transition"]
};
var ALL_MODES = ["quick", "standard", "critical"];
var G3 = (...guards) => ({ guards, conditionalGuards: [], modes: ALL_MODES });
var GM = (modes, ...guards) => ({ guards, conditionalGuards: [], modes });
var GC = (guards, conditionalGuards, modes = ALL_MODES) => ({ guards, conditionalGuards, modes });
var CRITICAL_WORKSPACE = { guard: "critical_workspace_ready", when: { mode: "critical" } };
var STATE_MACHINE_DEFINITION = {
  new: {
    macroPhase: "INTAKE",
    stable: false,
    terminal: false,
    capsule: CAPSULE.INTAKE,
    events: EVENTS.INTAKE,
    transitions: {
      awaiting_mode_confirmation: G3("task_initialized", "effective_constraints_valid"),
      blocked: G3("resume_metadata_valid"),
      cancelled: G3("terminal_source_recorded"),
      failed: G3("terminal_source_recorded")
    }
  },
  awaiting_mode_confirmation: {
    macroPhase: "INTAKE",
    stable: false,
    terminal: false,
    capsule: CAPSULE.INTAKE,
    events: EVENTS.INTAKE,
    transitions: {
      executing: GM(["quick"], "intake_complete", "mode_confirmed", "routing_ready", "quick_scope_bounded"),
      discovering: GC(["intake_complete", "mode_confirmed", "routing_ready"], [CRITICAL_WORKSPACE], ["standard", "critical"]),
      blocked: G3("resume_metadata_valid"),
      cancelled: G3("terminal_source_recorded"),
      failed: G3("terminal_source_recorded")
    }
  },
  discovering: {
    macroPhase: "SHAPE",
    stable: false,
    terminal: false,
    capsule: CAPSULE.SHAPE,
    events: EVENTS.SHAPE,
    transitions: {
      planning: G3("discovery_sufficient"),
      awaiting_mode_confirmation: G3("intake_reopened"),
      blocked: G3("resume_metadata_valid"),
      cancelled: G3("terminal_source_recorded"),
      failed: G3("terminal_source_recorded")
    }
  },
  planning: {
    macroPhase: "SHAPE",
    stable: false,
    terminal: false,
    capsule: CAPSULE.SHAPE,
    events: EVENTS.SHAPE,
    transitions: {
      discovering: G3(),
      awaiting_approval: G3("discovery_sufficient", "contract_complete"),
      awaiting_mode_confirmation: G3("intake_reopened"),
      blocked: G3("resume_metadata_valid"),
      cancelled: G3("terminal_source_recorded"),
      failed: G3("terminal_source_recorded")
    }
  },
  awaiting_approval: {
    macroPhase: "GATE",
    stable: false,
    terminal: false,
    capsule: CAPSULE.GATE,
    events: EVENTS.GATE,
    transitions: {
      planning: G3("gate_context_valid"),
      resolving_assure: G3("gate_context_valid", "correction_budget_available"),
      verifying: G3("gate_context_valid"),
      executing: G3("gate_context_valid", "approval_current", "task_authorized"),
      handing_off: G3("gate_context_valid", "verification_complete", "critical_completion_approved", "handoff_intent_resolved"),
      ready_for_handoff: G3("gate_context_valid", "verification_complete", "critical_completion_approved", "handoff_intent_resolved"),
      finished_local: G3("gate_context_valid", "verification_complete", "critical_completion_approved", "handoff_intent_resolved"),
      awaiting_mode_confirmation: G3("intake_reopened"),
      blocked: G3("resume_metadata_valid"),
      cancelled: G3("terminal_source_recorded"),
      failed: G3("terminal_source_recorded")
    }
  },
  executing: {
    macroPhase: "BUILD",
    stable: false,
    terminal: false,
    capsule: CAPSULE.BUILD,
    events: EVENTS.BUILD,
    transitions: {
      validating: G3("task_authorized"),
      planning: G3(),
      awaiting_mode_confirmation: G3("intake_reopened"),
      blocked: G3("resume_metadata_valid"),
      cancelled: G3("terminal_source_recorded"),
      failed: G3("terminal_source_recorded")
    }
  },
  validating: {
    macroPhase: "BUILD",
    stable: false,
    terminal: false,
    capsule: CAPSULE.BUILD,
    events: EVENTS.BUILD,
    transitions: {
      executing: G3("validation_fresh", "task_authorized"),
      resolving_build: G3("correction_budget_available"),
      reviewing: G3("validation_fresh"),
      verifying: G3("validation_fresh", "review_satisfied"),
      planning: G3(),
      awaiting_mode_confirmation: G3("intake_reopened"),
      blocked: G3("resume_metadata_valid"),
      cancelled: G3("terminal_source_recorded"),
      failed: G3("terminal_source_recorded")
    }
  },
  resolving_build: {
    macroPhase: "BUILD",
    stable: false,
    terminal: false,
    capsule: CAPSULE.BUILD,
    events: EVENTS.BUILD,
    transitions: {
      validating: G3("correction_budget_available"),
      planning: G3(),
      awaiting_mode_confirmation: G3("intake_reopened"),
      blocked: G3("resume_metadata_valid"),
      cancelled: G3("terminal_source_recorded"),
      failed: G3("terminal_source_recorded")
    }
  },
  reviewing: {
    macroPhase: "ASSURE",
    stable: false,
    terminal: false,
    capsule: CAPSULE.ASSURE,
    events: EVENTS.ASSURE,
    transitions: {
      resolving_assure: G3("correction_budget_available"),
      verifying: G3("review_satisfied"),
      planning: G3(),
      awaiting_mode_confirmation: G3("intake_reopened"),
      blocked: G3("resume_metadata_valid"),
      cancelled: G3("terminal_source_recorded"),
      failed: G3("terminal_source_recorded")
    }
  },
  resolving_assure: {
    macroPhase: "ASSURE",
    stable: false,
    terminal: false,
    capsule: CAPSULE.ASSURE,
    events: EVENTS.ASSURE,
    transitions: {
      validating: G3("correction_budget_available"),
      reviewing: G3("correction_budget_available"),
      verifying: G3("correction_budget_available"),
      planning: G3(),
      awaiting_mode_confirmation: G3("intake_reopened"),
      blocked: G3("resume_metadata_valid"),
      cancelled: G3("terminal_source_recorded"),
      failed: G3("terminal_source_recorded")
    }
  },
  verifying: {
    macroPhase: "ASSURE",
    stable: false,
    terminal: false,
    capsule: CAPSULE.ASSURE,
    events: EVENTS.ASSURE,
    transitions: {
      resolving_assure: G3("correction_budget_available"),
      planning: G3(),
      awaiting_approval: G3("verification_complete"),
      handing_off: G3("verification_complete", "handoff_intent_resolved"),
      ready_for_handoff: G3("verification_complete", "handoff_intent_resolved"),
      finished_local: G3("verification_complete", "handoff_intent_resolved"),
      awaiting_mode_confirmation: G3("intake_reopened"),
      blocked: G3("resume_metadata_valid"),
      cancelled: G3("terminal_source_recorded"),
      failed: G3("terminal_source_recorded")
    }
  },
  handing_off: {
    macroPhase: "HANDOFF",
    stable: false,
    terminal: false,
    capsule: CAPSULE.HANDOFF,
    events: EVENTS.HANDOFF,
    transitions: {
      ready_for_handoff: G3("handoff_intent_resolved", "handoff_reconciled"),
      finished: G3("handoff_intent_resolved", "handoff_reconciled"),
      awaiting_mode_confirmation: G3("intake_reopened"),
      blocked: G3("resume_metadata_valid"),
      cancelled: G3("terminal_source_recorded"),
      failed: G3("terminal_source_recorded")
    }
  },
  ready_for_handoff: {
    macroPhase: "HANDOFF",
    stable: true,
    terminal: false,
    capsule: CAPSULE.HANDOFF,
    events: EVENTS.HANDOFF,
    transitions: {
      handing_off: G3("handoff_intent_resolved", "handoff_reconciled"),
      finished: G3("handoff_intent_resolved", "handoff_reconciled"),
      awaiting_mode_confirmation: G3("intake_reopened"),
      blocked: G3("resume_metadata_valid"),
      cancelled: G3("terminal_source_recorded"),
      failed: G3("terminal_source_recorded")
    }
  },
  blocked: {
    macroPhase: "resumeTo",
    stable: true,
    terminal: false,
    capsule: { consumes: ["resumeTo", "remainingActions", "freshness"], produces: ["issues.active"], invalidates: ["source-phase-dependent"] },
    events: ["task.blocked", "task.resumed", "state.transition"],
    transitions: {
      awaiting_mode_confirmation: G3("resume_metadata_valid", "resume_reconciled", "task_initialized", "effective_constraints_valid"),
      discovering: GC(["resume_metadata_valid", "resume_reconciled", "mode_confirmed", "routing_ready"], [CRITICAL_WORKSPACE]),
      planning: G3("resume_metadata_valid", "resume_reconciled", "discovery_sufficient"),
      awaiting_approval: G3("resume_metadata_valid", "resume_reconciled", "contract_complete"),
      executing: G3("resume_metadata_valid", "resume_reconciled", "approval_current", "task_authorized"),
      validating: G3("resume_metadata_valid", "resume_reconciled", "task_authorized"),
      resolving_build: G3("resume_metadata_valid", "resume_reconciled", "correction_budget_available"),
      reviewing: G3("resume_metadata_valid", "resume_reconciled", "validation_fresh"),
      resolving_assure: G3("resume_metadata_valid", "resume_reconciled", "correction_budget_available"),
      verifying: G3("resume_metadata_valid", "resume_reconciled", "review_satisfied"),
      handing_off: G3("resume_metadata_valid", "resume_reconciled", "handoff_intent_resolved", "handoff_reconciled"),
      cancelled: G3("terminal_source_recorded"),
      failed: G3("terminal_source_recorded")
    }
  },
  cancelled: {
    macroPhase: "terminalSource",
    stable: true,
    terminal: true,
    transitions: {},
    capsule: { consumes: ["terminal.source", "freshness"], produces: ["terminal.summary"], invalidates: [] },
    events: ["task.cancelled"]
  },
  failed: {
    macroPhase: "terminalSource",
    stable: true,
    terminal: true,
    transitions: {},
    capsule: { consumes: ["terminal.source", "issues.active", "freshness"], produces: ["terminal.summary"], invalidates: [] },
    events: ["task.failed"]
  },
  finished_local: {
    macroPhase: "HANDOFF",
    stable: true,
    terminal: true,
    transitions: {},
    capsule: CAPSULE.HANDOFF,
    events: ["task.finished_local"]
  },
  finished: {
    macroPhase: "HANDOFF",
    stable: true,
    terminal: true,
    transitions: {},
    capsule: CAPSULE.HANDOFF,
    events: ["task.finished"]
  }
};
var STATE_MACHINE = deepFreeze(STATE_MACHINE_DEFINITION);
var TASK_STATUSES = Object.freeze(Object.keys(STATE_MACHINE));
function buildStateMachineProjection() {
  return {
    macroPhases: [...MACRO_PHASES],
    guards: [...GUARD_IDS],
    states: TASK_STATUSES.map((status) => {
      const state = STATE_MACHINE[status];
      return {
        status,
        macroPhase: state.macroPhase,
        stable: state.stable,
        terminal: state.terminal,
        transitions: Object.entries(state.transitions).map(([target, transition2]) => ({
          target,
          guards: [...transition2.guards],
          modes: [...transition2.modes],
          conditionalGuards: transition2.conditionalGuards.map((conditional) => ({
            guard: conditional.guard,
            when: { ...conditional.when }
          }))
        })),
        capsule: {
          consumes: [...state.capsule.consumes],
          produces: [...state.capsule.produces],
          invalidates: [...state.capsule.invalidates]
        },
        events: [...state.events]
      };
    })
  };
}
function isTaskStatus(value) {
  return typeof value === "string" && Object.hasOwn(STATE_MACHINE, value);
}
function deriveMacroPhase(state) {
  return derive(state.status, state, /* @__PURE__ */ new Set());
}
function derive(status, state, seen) {
  if (seen.has(status)) throw new Error(`Cannot derive macro-phase: recursive source at ${status}.`);
  seen.add(status);
  const rule = STATE_MACHINE[status].macroPhase;
  if (rule !== "resumeTo" && rule !== "terminalSource") return rule;
  if (rule === "resumeTo") {
    if (!state.resumeTo || !isOperationalResumeTarget(state.resumeTo)) {
      throw new Error(`Cannot derive macro-phase for blocked: invalid resumeTo ${String(state.resumeTo)}.`);
    }
    return derive(state.resumeTo, state, seen);
  }
  const event = [...state.history].reverse().find(
    (candidate) => isRecord5(candidate) && candidate.type === "state.transition"
  );
  const source = event?.terminalSource;
  if (event?.to !== status || !isTaskStatus(source) || event.from !== source || STATE_MACHINE[source].terminal) {
    throw new Error(`Cannot derive macro-phase for ${status}: valid terminal source event missing.`);
  }
  if (source === "blocked") {
    const terminalResumeTo = event.terminalResumeTo;
    if (!isTaskStatus(terminalResumeTo) || !isOperationalResumeTarget(terminalResumeTo)) throw new Error(`Cannot derive macro-phase for ${status}: blocked terminal source lacks operational resumeTo.`);
    return derive(terminalResumeTo, { ...state, status: terminalResumeTo }, seen);
  }
  return derive(source, { ...state, status: source }, seen);
}
function isOperationalResumeTarget(status) {
  return status !== "new" && !STATE_MACHINE[status].stable && !STATE_MACHINE[status].terminal;
}
function isRecord5(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function deepFreeze(value) {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

// src/state-store.ts
var import_yaml3 = __toESM(require_dist(), 1);
import { randomUUID as randomUUID3 } from "node:crypto";
import { constants as constants2, lstatSync as lstatSync2, realpathSync as realpathSync2 } from "node:fs";
import * as nodeFs from "node:fs/promises";
import { isAbsolute, join as join4, relative, resolve as resolve2, sep } from "node:path";

// src/state.ts
import { createHash } from "node:crypto";

// src/state-validator.ts
var import__2 = __toESM(require__(), 1);

// schemas/state.schema.json
var state_schema_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Codex Dev Flow task state V2",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "taskId", "status", "revision", "mode", "modeEvidenceRef", "modeConfirmed", "configSnapshot", "policySnapshot", "issues", "reviewCycle", "remainingActions", "history"],
  properties: {
    schemaVersion: { type: "integer", const: 2 },
    taskId: { type: "string", minLength: 1 },
    revision: { type: "integer", minimum: 0 },
    mode: { type: "string", enum: ["quick", "standard", "critical"] },
    modeEvidenceRef: { type: "string", minLength: 1 },
    modeConfirmed: { type: "boolean" },
    contractDigest: { type: "string", minLength: 1 },
    verificationRequirements: { $ref: "#/$defs/verificationRequirements" },
    pendingGate: { type: "string", enum: ["pre_build", "critical_completion"] },
    status: {
      type: "string",
      enum: ["new", "awaiting_mode_confirmation", "discovering", "planning", "awaiting_approval", "executing", "validating", "resolving_build", "reviewing", "resolving_assure", "verifying", "handing_off", "ready_for_handoff", "blocked", "cancelled", "failed", "finished_local", "finished"]
    },
    resumeTo: {
      type: "string",
      enum: ["awaiting_mode_confirmation", "discovering", "planning", "awaiting_approval", "executing", "validating", "resolving_build", "reviewing", "resolving_assure", "verifying", "handing_off"]
    },
    configSnapshot: { type: "object" },
    policySnapshot: { type: "object" },
    issues: { type: "array" },
    reviewCycle: { type: "integer", minimum: 0 },
    remainingActions: { type: "array", items: { type: "string", minLength: 1 } },
    historySummary: { $ref: "#/$defs/historySummary" },
    activeArtifact: { $ref: "#/$defs/activeArtifact" },
    activeWorktree: { $ref: "#/$defs/activeWorktree" },
    contextCapsule: { $ref: "#/$defs/contextCapsule" },
    history: {
      type: "array",
      items: { oneOf: [{ $ref: "#/$defs/transitionEvent" }, { $ref: "#/$defs/workflowEvent" }] }
    },
    routingPolicyVersion: { type: "string", minLength: 1 },
    routingSnapshot: { $ref: "#/$defs/routingSnapshot" },
    routingDecisions: {
      type: "array",
      items: { $ref: "#/$defs/routingDecision" }
    },
    intake: { $ref: "#/$defs/intakeState" },
    benchmarkEnabled: { type: "boolean" }
  },
  allOf: [
    {
      if: { properties: { status: { const: "blocked" } }, required: ["status"] },
      then: {
        required: ["resumeTo"],
        properties: {
          resumeTo: { $ref: "#/$defs/resumeTarget" },
          remainingActions: { type: "array", minItems: 1 }
        }
      }
    },
    {
      if: { properties: { status: { const: "ready_for_handoff" } }, required: ["status"] },
      then: {
        required: ["resumeTo"],
        properties: {
          resumeTo: { const: "handing_off" },
          remainingActions: { type: "array", minItems: 1 }
        }
      }
    },
    {
      if: {
        properties: { status: { not: { enum: ["blocked", "ready_for_handoff"] } } },
        required: ["status"]
      },
      then: { not: { required: ["resumeTo"] } }
    },
    {
      if: { properties: { status: { const: "awaiting_approval" } }, required: ["status"] },
      then: {
        required: ["pendingGate", "contractDigest"],
        properties: {
          pendingGate: { type: "string", enum: ["pre_build", "critical_completion"] },
          contractDigest: { type: "string", minLength: 1 }
        }
      }
    },
    {
      if: { required: ["pendingGate"] },
      then: {
        properties: { status: { type: "string", enum: ["awaiting_approval", "blocked"] } }
      }
    },
    {
      if: { properties: { status: { const: "cancelled" } }, required: ["status"] },
      then: {
        properties: {
          history: {
            type: "array",
            contains: {
              type: "object",
              required: ["type", "to", "terminalSource"],
              properties: {
                type: { const: "state.transition" },
                to: { const: "cancelled" },
                terminalSource: { $ref: "#/$defs/nonTerminalStatus" }
              }
            }
          }
        }
      }
    },
    {
      if: { properties: { status: { const: "failed" } }, required: ["status"] },
      then: {
        properties: {
          history: {
            type: "array",
            contains: {
              type: "object",
              required: ["type", "to", "terminalSource"],
              properties: {
                type: { const: "state.transition" },
                to: { const: "failed" },
                terminalSource: { $ref: "#/$defs/nonTerminalStatus" }
              }
            }
          }
        }
      }
    }
  ],
  $defs: {
    eventAt: {
      type: "string",
      oneOf: [
        { pattern: "^(?!0000)(?:[0-9]{4}-(?:(?:01|03|05|07|08|10|12)-(?:0[1-9]|[12][0-9]|3[01])|(?:04|06|09|11)-(?:0[1-9]|[12][0-9]|30)|02-(?:0[1-9]|1[0-9]|2[0-8])))T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:\\.[0-9]+)?(?:Z|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])$" },
        { pattern: "^(?!0000)(?:[0-9]{2}(?:0[48]|[2468][048]|[13579][26])|(?:[02468][048]|[13579][26])00)-02-29T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:\\.[0-9]+)?(?:Z|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])$" }
      ]
    },
    historyReference: {
      type: "object",
      additionalProperties: false,
      required: ["kind", "ref"],
      properties: {
        kind: { type: "string", enum: ["task", "mode-evidence", "migration-source", "migration-target", "artifact", "worktree", "context-capsule", "context", "issue", "correction", "gate", "scope", "handoff", "evidence", "receipt", "command", "criterion", "decision", "policy", "config", "git", "symbol"] },
        ref: { type: "string", minLength: 1, maxLength: 512, pattern: "^[A-Za-z0-9][A-Za-z0-9._:/#@+~=-]*$" },
        fingerprint: { type: "string", minLength: 1, maxLength: 512, pattern: "^[A-Za-z0-9][A-Za-z0-9._:/#@+~=-]*$" }
      }
    },
    transitionEvent: {
      type: "object",
      additionalProperties: false,
      required: ["type", "from", "to", "revision", "sourceFingerprint"],
      properties: {
        sequence: { type: "integer", minimum: 1 },
        at: { $ref: "#/$defs/eventAt" },
        type: { const: "state.transition" },
        from: { $ref: "#/$defs/status" },
        to: { $ref: "#/$defs/status" },
        mode: { type: "string", enum: ["quick", "standard", "critical"] },
        revision: { type: "integer", minimum: 1 },
        sourceFingerprint: { type: "string", minLength: 1 },
        terminalSource: { $ref: "#/$defs/nonTerminalStatus" },
        terminalResumeTo: { $ref: "#/$defs/resumeTarget" },
        gateContext: { type: "string", enum: ["pre_build", "critical_completion"] },
        contractDigest: { type: "string", minLength: 1 },
        guardEvidence: { type: "array", minItems: 1, items: { $ref: "#/$defs/guardEvidence" } },
        gateDecision: { $ref: "#/$defs/gateDecision" },
        legacyData: { type: "object" }
      },
      dependentRequired: { sequence: ["at"], at: ["sequence"] }
    },
    workflowEvent: {
      type: "object",
      additionalProperties: false,
      required: ["sequence", "at", "type", "refs"],
      properties: {
        sequence: { type: "integer", minimum: 1 },
        at: { $ref: "#/$defs/eventAt" },
        type: { type: "string", enum: ["task.created", "state.migrated", "task.blocked", "task.resumed", "gate.recorded", "scope.approved", "artifact.recorded", "issue.recorded", "correction.recorded", "handoff.attempted", "handoff.result", "context.updated", "intake.question_recorded", "intake.answer_recorded", "intake.checkpoint", "advance.rejected", "intake.reopened"] },
        refs: { type: "array", minItems: 1, maxItems: 16, items: { $ref: "#/$defs/historyReference" } }
      }
    },
    historySummary: {
      type: "object",
      additionalProperties: false,
      required: ["removedCount", "firstSequence", "lastSequence", "firstAt", "lastAt", "typeCounts", "modeConfirmed"],
      properties: {
        removedCount: { type: "integer", minimum: 1 },
        firstSequence: { type: "integer", minimum: 1 },
        lastSequence: { type: "integer", minimum: 1 },
        firstAt: { $ref: "#/$defs/eventAt" },
        lastAt: { $ref: "#/$defs/eventAt" },
        typeCounts: { type: "object", minProperties: 1, additionalProperties: { type: "integer", minimum: 1 } },
        modeConfirmed: { type: "boolean" },
        lastTransition: {
          type: "object",
          additionalProperties: false,
          required: ["sequence", "revision", "to"],
          properties: {
            sequence: { type: "integer", minimum: 1 },
            revision: { type: "integer", minimum: 1 },
            to: { $ref: "#/$defs/status" }
          }
        },
        activeGate: { $ref: "#/$defs/historyGateAnchor" }
      }
    },
    historyGateAnchor: {
      type: "object",
      additionalProperties: false,
      required: ["gateContext", "contractDigest", "entrySequence", "entryRevision", "entryFrom", "sourceFingerprint"],
      properties: {
        gateContext: { type: "string", enum: ["pre_build", "critical_completion"] },
        contractDigest: { type: "string", minLength: 1 },
        entrySequence: { type: "integer", minimum: 1 },
        entryRevision: { type: "integer", minimum: 1 },
        entryFrom: { type: "string", enum: ["planning", "verifying"] },
        sourceFingerprint: { type: "string", minLength: 1 },
        verificationReceipt: { $ref: "#/$defs/evaluatorReceipt" }
      }
    },
    activeArtifact: {
      type: "object",
      additionalProperties: false,
      required: ["artifactId", "ownerRef", "fingerprint"],
      properties: {
        artifactId: { type: "string", minLength: 1, maxLength: 1024 },
        ownerRef: { type: "string", minLength: 1, maxLength: 1024 },
        fingerprint: { type: "string", minLength: 1, maxLength: 1024 }
      }
    },
    activeWorktree: {
      type: "object",
      additionalProperties: false,
      required: ["worktreeRef", "gitFingerprint"],
      properties: {
        worktreeRef: { type: "string", minLength: 1, maxLength: 1024 },
        gitFingerprint: { type: "string", minLength: 1, maxLength: 1024 }
      }
    },
    contextCapsule: {
      type: "object",
      additionalProperties: false,
      required: ["schemaVersion", "entries", "fingerprints"],
      properties: {
        schemaVersion: { type: "integer", const: 1 },
        entries: { type: "array", maxItems: 128, items: { $ref: "#/$defs/contextCapsuleEntry" } },
        fingerprints: { type: "array", maxItems: 64, items: { $ref: "#/$defs/contextCapsuleFingerprint" } }
      }
    },
    contextCapsuleEntry: {
      type: "object",
      additionalProperties: false,
      required: ["section", "ownerRef", "provenanceRef", "fingerprintRefs"],
      properties: {
        section: { type: "string", enum: ["objective", "approved_scope", "risk", "relevant_code", "constraints", "acceptance", "decision", "evidence"] },
        ownerRef: { type: "string", minLength: 1, maxLength: 1024 },
        provenanceRef: { type: "string", minLength: 1, maxLength: 1024 },
        fingerprintRefs: { type: "array", minItems: 1, uniqueItems: true, items: { type: "string", minLength: 1, maxLength: 1024 } }
      }
    },
    contextCapsuleFingerprint: {
      type: "object",
      additionalProperties: false,
      required: ["id", "kind", "value", "provenanceRef"],
      properties: {
        id: { type: "string", minLength: 1, maxLength: 1024 },
        kind: { type: "string", enum: ["git", "config", "policy", "artifact", "worktree"] },
        value: { type: "string", minLength: 1, maxLength: 1024 },
        provenanceRef: { type: "string", minLength: 1, maxLength: 1024 }
      }
    },
    verificationRequirements: {
      type: "object",
      additionalProperties: false,
      required: ["schemaVersion", "sourceDigest", "requirementsDigest", "criterionIds", "mandatoryCheckIds"],
      properties: {
        schemaVersion: { type: "integer", const: 1 },
        sourceDigest: { type: "string", minLength: 1 },
        requirementsDigest: { type: "string", minLength: 1 },
        criterionIds: { type: "array", minItems: 1, uniqueItems: true, items: { type: "string", minLength: 1 } },
        mandatoryCheckIds: { type: "array", uniqueItems: true, items: { type: "string", minLength: 1 } }
      }
    },
    guardId: {
      type: "string",
      enum: ["task_initialized", "effective_constraints_valid", "mode_confirmed", "intake_complete", "intake_reopened", "routing_ready", "quick_scope_bounded", "critical_workspace_ready", "discovery_sufficient", "contract_complete", "approval_current", "task_authorized", "validation_fresh", "review_satisfied", "verification_complete", "correction_budget_available", "resume_metadata_valid", "resume_reconciled", "terminal_source_recorded", "gate_context_valid", "handoff_intent_resolved", "handoff_reconciled", "critical_completion_approved"]
    },
    guardEvidence: {
      type: "object",
      additionalProperties: false,
      required: ["schemaVersion", "guard", "stateRevision", "stateFingerprint", "observedFingerprint", "evidenceRefs", "provenance", "result"],
      properties: {
        schemaVersion: { type: "integer", const: 1 },
        guard: { $ref: "#/$defs/guardId" },
        stateRevision: { type: "integer", minimum: 0 },
        stateFingerprint: { type: "string", minLength: 1 },
        observedFingerprint: { type: "string", minLength: 1 },
        evidenceRefs: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
        provenance: { type: "string", enum: ["deterministic-check", "human-approval", "repository-observation", "migration-history"] },
        result: { type: "string", enum: ["passed", "not_applicable"] },
        evaluatorReceipt: { $ref: "#/$defs/evaluatorReceipt" }
      },
      allOf: [
        {
          if: {
            allOf: [
              { properties: { guard: { enum: ["intake_complete", "verification_complete", "handoff_intent_resolved", "handoff_reconciled", "critical_completion_approved"] } }, required: ["guard"] },
              {
                not: {
                  properties: {
                    guard: { const: "intake_complete" },
                    provenance: { const: "migration-history" }
                  },
                  required: ["guard", "provenance"]
                }
              }
            ]
          },
          then: { properties: { evaluatorReceipt: { $ref: "#/$defs/evaluatorReceipt" } }, required: ["evaluatorReceipt"] },
          else: { not: { required: ["evaluatorReceipt"] } }
        }
      ]
    },
    evaluatorReceipt: {
      type: "object",
      additionalProperties: false,
      required: ["schemaVersion", "evaluator", "outcome", "stateRevision", "stateFingerprint", "inputDigest", "evidenceRefs", "subjectIds", "completedIds", "receiptDigest"],
      properties: {
        schemaVersion: { type: "integer", const: 1 },
        evaluator: { type: "string", enum: ["intake", "verification", "handoff_intent", "handoff_reconciliation", "critical_completion"] },
        outcome: { type: "string", enum: ["intake_complete", "complete", "local_only", "external_selected", "action_required", "approved"] },
        stateRevision: { type: "integer", minimum: 0 },
        stateFingerprint: { type: "string", minLength: 1 },
        inputDigest: { type: "string", minLength: 1 },
        evidenceRefs: { type: "array", minItems: 1, uniqueItems: true, items: { type: "string", minLength: 1 } },
        subjectIds: { type: "array", minItems: 1, uniqueItems: true, items: { type: "string", minLength: 1 } },
        completedIds: { type: "array", uniqueItems: true, items: { type: "string", minLength: 1 } },
        receiptDigest: { type: "string", minLength: 1 }
      }
    },
    gateDecision: {
      type: "object",
      additionalProperties: false,
      required: ["schemaVersion", "gate", "decision", "stateRevision", "stateFingerprint", "evidenceRef", "contractDigest"],
      properties: {
        schemaVersion: { type: "integer", const: 1 },
        gate: { type: "string", enum: ["pre_build", "critical_completion"] },
        decision: { type: "string", enum: ["approved", "rejected", "change_requested"] },
        stateRevision: { type: "integer", minimum: 0 },
        stateFingerprint: { type: "string", minLength: 1 },
        evidenceRef: { type: "string", minLength: 1 },
        contractDigest: { type: "string", minLength: 1 }
      }
    },
    status: {
      type: "string",
      enum: ["new", "awaiting_mode_confirmation", "discovering", "planning", "awaiting_approval", "executing", "validating", "resolving_build", "reviewing", "resolving_assure", "verifying", "handing_off", "ready_for_handoff", "blocked", "cancelled", "failed", "finished_local", "finished"]
    },
    nonTerminalStatus: {
      type: "string",
      enum: ["new", "awaiting_mode_confirmation", "discovering", "planning", "awaiting_approval", "executing", "validating", "resolving_build", "reviewing", "resolving_assure", "verifying", "handing_off", "ready_for_handoff", "blocked"]
    },
    resumeTarget: {
      type: "string",
      enum: ["awaiting_mode_confirmation", "discovering", "planning", "awaiting_approval", "executing", "validating", "resolving_build", "reviewing", "resolving_assure", "verifying", "handing_off"]
    },
    routingSnapshot: {
      type: "object",
      additionalProperties: false,
      required: ["schemaVersion", "capturedAt", "plan", "account", "quota", "models", "warnings", "provenance"],
      properties: {
        schemaVersion: { type: "integer", const: 1 },
        capturedAt: { type: "string" },
        plan: { type: "string", enum: ["plus", "pro_5x", "pro_20x", "unknown"] },
        account: {
          type: "object",
          additionalProperties: false,
          properties: { planType: { type: "string" } }
        },
        quota: {
          type: "object",
          additionalProperties: false,
          required: ["pressure", "source"],
          properties: {
            windowDurationMins: { type: "number" },
            usedPercent: { type: "number", minimum: 0, maximum: 100 },
            resetsAt: { type: "number" },
            pressure: { type: "string", enum: ["normal", "warning", "critical", "unknown"] },
            source: { type: "string", enum: ["app-server", "last-known", "unknown"] },
            observedWindow: {
              type: "object",
              additionalProperties: false,
              required: ["windowDurationMins", "usedPercent"],
              properties: {
                windowDurationMins: { type: "number" },
                usedPercent: { type: "number", minimum: 0, maximum: 100 },
                resetsAt: { type: "number" }
              }
            }
          }
        },
        models: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "supportedReasoningEfforts"],
            properties: {
              id: { type: "string", enum: ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol"] },
              supportedReasoningEfforts: {
                type: "array",
                items: { type: "string", enum: ["low", "medium", "high", "xhigh"] }
              }
            }
          }
        },
        warnings: { type: "array", items: { type: "string" } },
        provenance: {
          type: "object",
          additionalProperties: false,
          required: ["plan", "quota", "models"],
          properties: {
            plan: { type: "string", enum: ["config", "account/read", "unknown"] },
            quota: { type: "string", enum: ["account/rateLimits/read", "last-known-cache", "unknown"] },
            models: { type: "string", enum: ["model/list", "unknown"] }
          }
        },
        subscriptionMultiplier: { type: "number", exclusiveMinimum: 0 }
      }
    },
    routingDecision: {
      type: "object",
      additionalProperties: false,
      required: ["stage", "model", "effort", "quotaPressure", "reason", "warnings"],
      properties: {
        stage: { type: "string", enum: ["discover", "plan", "execute", "debug", "review", "verify"] },
        model: { type: ["string", "null"], enum: ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol", null] },
        effort: { type: ["string", "null"], enum: ["low", "medium", "high", "xhigh", null] },
        quotaPressure: { type: "string", enum: ["normal", "warning", "critical", "unknown"] },
        reason: { type: "string" },
        warnings: { type: "array", items: { type: "string" } }
      }
    },
    intakeState: {
      type: "object",
      additionalProperties: false,
      required: ["schemaVersion", "brief", "decisions", "answeredDecisionKeys", "invalidations", "contradictions", "semanticComplete", "deterministicComplete", "checkpointDue", "semanticRetryCount", "metrics"],
      properties: {
        schemaVersion: { type: "integer", const: 1 },
        brief: { $ref: "#/$defs/intakeBrief" },
        activeQuestion: { $ref: "#/$defs/decisionQuestion" },
        decisions: {
          type: "array",
          maxItems: 32,
          items: { $ref: "#/$defs/intakeDecision" }
        },
        answeredDecisionKeys: {
          type: "array",
          maxItems: 32,
          uniqueItems: true,
          items: { $ref: "#/$defs/intakeText" }
        },
        invalidations: {
          type: "array",
          maxItems: 32,
          items: { $ref: "#/$defs/intakeInvalidation" }
        },
        contradictions: {
          type: "array",
          maxItems: 32,
          items: { $ref: "#/$defs/intakeText" }
        },
        semanticComplete: { type: "boolean" },
        deterministicComplete: { type: "boolean" },
        checkpointDue: { type: "boolean" },
        semanticRetryCount: { type: "integer", minimum: 0, maximum: 1 },
        blockedReason: { type: "string", enum: ["semantic_output_invalid", "answer_required"] },
        metrics: { $ref: "#/$defs/intakeMetrics" }
      }
    },
    intakeBrief: {
      type: "object",
      additionalProperties: false,
      required: ["schemaVersion", "mode", "risk", "provenance", "technicalUnknowns"],
      properties: {
        schemaVersion: { type: "integer", const: 1 },
        objective: { $ref: "#/$defs/intakeText" },
        successSignal: {
          type: "object",
          additionalProperties: false,
          required: ["description", "observationMethod"],
          properties: {
            description: { $ref: "#/$defs/intakeText" },
            observationMethod: { $ref: "#/$defs/intakeText" },
            validator: { $ref: "#/$defs/intakeText" },
            guardrails: { $ref: "#/$defs/intakeTextList" }
          }
        },
        mode: { type: "string", enum: ["quick", "standard", "critical"] },
        risk: { type: "string", enum: ["low", "medium", "high", "critical"] },
        provenance: {
          type: "object",
          additionalProperties: false,
          required: ["sourceRefs", "capturedAt", "freshnessRefs"],
          properties: {
            sourceRefs: { $ref: "#/$defs/intakeTextList" },
            capturedAt: { $ref: "#/$defs/eventAt" },
            freshnessRefs: { $ref: "#/$defs/intakeTextList" }
          }
        },
        successValidator: { $ref: "#/$defs/intakeText" },
        successGuardrails: { $ref: "#/$defs/intakeTextList" },
        determiningConstraints: { $ref: "#/$defs/intakeTextList" },
        affectedUsers: { $ref: "#/$defs/intakeTextList" },
        motivation: { $ref: "#/$defs/intakeText" },
        urgency: { $ref: "#/$defs/intakeText" },
        scopeBoundaries: { $ref: "#/$defs/intakeTextList" },
        technicalUnknowns: {
          type: "array",
          maxItems: 32,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["key", "kind", "description", "owner"],
            properties: {
              key: { $ref: "#/$defs/intakeText" },
              kind: { type: "string", enum: ["code", "dependency", "architecture", "validation", "operations"] },
              description: { $ref: "#/$defs/intakeText" },
              owner: { const: "shape" }
            }
          }
        }
      }
    },
    decisionQuestion: {
      type: "object",
      additionalProperties: false,
      required: ["schemaVersion", "id", "decisionKey", "missingInformation", "determiningImpact", "prompt", "options", "recommendedOptionId", "recommendationBasis", "recommendationConfidence", "freeFormAllowed", "clarificationCount"],
      properties: {
        schemaVersion: { type: "integer", const: 1 },
        id: { $ref: "#/$defs/intakeText" },
        decisionKey: { $ref: "#/$defs/intakeText" },
        missingInformation: { $ref: "#/$defs/intakeText" },
        determiningImpact: { $ref: "#/$defs/intakeText" },
        prompt: { $ref: "#/$defs/intakeText" },
        options: {
          type: "array",
          minItems: 2,
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "label", "impact"],
            properties: {
              id: { $ref: "#/$defs/intakeText" },
              label: { $ref: "#/$defs/intakeText" },
              impact: { $ref: "#/$defs/intakeText" }
            }
          }
        },
        recommendedOptionId: { $ref: "#/$defs/intakeText" },
        recommendationBasis: { $ref: "#/$defs/intakeText" },
        recommendationConfidence: { type: "string", enum: ["high", "medium", "low"] },
        freeFormAllowed: { const: true },
        clarificationCount: { type: "integer", minimum: 0, maximum: 2 }
      }
    },
    intakeDecision: {
      type: "object",
      additionalProperties: false,
      required: ["key", "value", "source", "provenanceRef", "recommendationDisposition", "dependsOn"],
      properties: {
        key: { $ref: "#/$defs/intakeText" },
        value: { $ref: "#/$defs/intakeText" },
        source: { type: "string", enum: ["user", "repository"] },
        provenanceRef: { $ref: "#/$defs/intakeText" },
        recommendationDisposition: { type: "string", enum: ["accepted", "modified", "not_applicable"] },
        dependsOn: { $ref: "#/$defs/intakeTextList" }
      }
    },
    intakeInvalidation: {
      type: "object",
      additionalProperties: false,
      required: ["decisionKey", "reason", "at"],
      properties: {
        decisionKey: { $ref: "#/$defs/intakeText" },
        reason: { $ref: "#/$defs/intakeText" },
        at: { $ref: "#/$defs/eventAt" }
      }
    },
    intakeMetrics: {
      type: "object",
      additionalProperties: false,
      required: ["modelCalls", "questionsAsked", "questionsAvoided", "distinctQuestions", "recommendationsAccepted", "recommendationsModified", "zeroQuestionPath", "lateReopenings", "modeChanges"],
      properties: {
        modelCalls: { type: "integer", minimum: 0 },
        questionsAsked: { type: "integer", minimum: 0 },
        questionsAvoided: { type: "integer", minimum: 0 },
        distinctQuestions: { type: "integer", minimum: 0 },
        recommendationsAccepted: { type: "integer", minimum: 0 },
        recommendationsModified: { type: "integer", minimum: 0 },
        zeroQuestionPath: { type: "boolean" },
        lateReopenings: { type: "integer", minimum: 0 },
        modeChanges: { type: "integer", minimum: 0 },
        inputTokens: { type: "integer", minimum: 0 },
        outputTokens: { type: "integer", minimum: 0 },
        latencyMs: { type: "integer", minimum: 0 }
      }
    },
    intakeText: {
      type: "string",
      minLength: 1,
      maxLength: 2e3,
      pattern: "^[^\\u0000\\r\\n]+$"
    },
    intakeTextList: {
      type: "array",
      maxItems: 32,
      uniqueItems: true,
      items: { $ref: "#/$defs/intakeText" }
    }
  }
};

// src/state-validator.ts
var ajv = new import__2.Ajv2020({ allErrors: true, strict: true });
var validate = ajv.compile(state_schema_default);
function validateStateV2(value) {
  const valid = validate(value);
  return { valid, errors: validate.errors ? [...validate.errors] : [] };
}

// src/state.ts
var HISTORY_LIMIT = 200;
var HISTORY_REFERENCE_LIMIT = 16;
var HISTORY_REFERENCE_TOTAL_CHARS = 4096;
var StateMigrationError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "StateMigrationError";
  }
  code;
};
function createState(input) {
  if (!isTaskMode(input.mode) || !nonEmpty(input.modeEvidenceRef)) throw new Error("createState requires mode and modeEvidenceRef.");
  const contextCapsule = input.contextCapsule ?? defaultContextCapsule(input.configSnapshot, input.policySnapshot);
  const created = {
    sequence: 1,
    at: normalizeEventAt(input.at),
    type: "task.created",
    refs: [
      { kind: "task", ref: "state:taskId" },
      { kind: "mode-evidence", ref: "state:modeEvidenceRef" }
    ]
  };
  const state = {
    schemaVersion: 2,
    taskId: input.taskId,
    status: "new",
    revision: 0,
    mode: input.mode,
    modeEvidenceRef: input.modeEvidenceRef,
    modeConfirmed: false,
    configSnapshot: input.configSnapshot,
    policySnapshot: input.policySnapshot,
    issues: [],
    reviewCycle: 0,
    remainingActions: [],
    history: [created],
    ...input.activeArtifact ? { activeArtifact: copy2(input.activeArtifact) } : {},
    ...input.activeWorktree ? { activeWorktree: copy2(input.activeWorktree) } : {},
    contextCapsule: copy2(contextCapsule),
    ...input.intake ? { intake: copy2(input.intake) } : {},
    benchmarkEnabled: input.benchmarkEnabled ?? false,
    ...input.routingSnapshot ? { routingSnapshot: input.routingSnapshot } : {},
    routingPolicyVersion: ROUTING_POLICY_VERSION,
    routingDecisions: [],
    ...input.verificationRequirements ? {
      verificationRequirements: {
        ...copy2(input.verificationRequirements),
        requirementsDigest: digest({
          criterionIds: input.verificationRequirements.criterionIds,
          mandatoryCheckIds: input.verificationRequirements.mandatoryCheckIds
        })
      }
    } : {}
  };
  assertV2State(state);
  return state;
}
function guardStateFingerprint(state) {
  return createHash("sha256").update(stable({
    base: stateFingerprintAtRevision(state, state.revision),
    status: state.status,
    modeConfirmed: state.modeConfirmed,
    resumeTo: state.resumeTo,
    remainingActions: state.remainingActions,
    pendingGate: state.pendingGate,
    contractDigest: state.contractDigest,
    issues: state.issues,
    reviewCycle: state.reviewCycle,
    routingDecisions: state.routingDecisions,
    intake: state.intake,
    benchmarkEnabled: state.benchmarkEnabled
  })).digest("hex");
}
function createGuardAttestation(state, guard, input) {
  assertV2State(state);
  if (!GUARD_IDS.includes(guard)) throw new Error(`Unknown transition guard ${String(guard)}.`);
  if (guard === "intake_complete") {
    validateCompleteIntake(state);
    if (!Array.isArray(input.evidenceRefs) || !input.evidenceRefs.length || !input.evidenceRefs.every(nonEmpty)) {
      throw new Error("intake_complete requires evidence references.");
    }
    const subjectIds = ["objective", "success_signal", "mode", "risk"];
    return createEvaluatorEvidence(state, "intake_complete", "deterministic-check", {
      evaluator: "intake",
      outcome: "intake_complete",
      inputDigest: digest(state.intake),
      evidenceRefs: [...input.evidenceRefs],
      subjectIds,
      completedIds: subjectIds
    });
  }
  if (TRUSTED_EVALUATOR_REQUIRED.has(guard)) throw new Error(`Guard ${guard} requires trusted evaluator.`);
  const evidence = {
    schemaVersion: 1,
    guard,
    stateRevision: state.revision,
    stateFingerprint: guardStateFingerprint(state),
    observedFingerprint: input.observedFingerprint,
    evidenceRefs: [...input.evidenceRefs],
    provenance: input.provenance,
    result: input.result ?? "passed"
  };
  validateGuardEvidence(state, evidence);
  return evidence;
}
var trustedEvaluatorEvidence = /* @__PURE__ */ new WeakSet();
function evaluateVerification(state, input) {
  assertV2State(state);
  const requirements = state.verificationRequirements;
  if (!requirements) throw new Error("Verification requires state-bound verificationRequirements.");
  validateVerificationRequirements(requirements);
  assertExactObservations(state, "acceptance criteria", requirements.criterionIds, input.criteria, true);
  assertExactObservations(state, "mandatory checks", requirements.mandatoryCheckIds, input.mandatoryChecks, false);
  const observations = [...input.criteria, ...input.mandatoryChecks];
  const subjectIds = [
    ...requirements.criterionIds.map((id) => `criterion:${id}`),
    ...requirements.mandatoryCheckIds.map((id) => `check:${id}`)
  ];
  return createEvaluatorEvidence(state, "verification_complete", "deterministic-check", {
    evaluator: "verification",
    outcome: "complete",
    inputDigest: digest({
      requirements,
      criteria: input.criteria.map(({ stateRevision: _stateRevision, ...item }) => item),
      mandatoryChecks: input.mandatoryChecks.map(({ stateRevision: _stateRevision, ...item }) => item)
    }),
    evidenceRefs: observations.map((item) => item.evidenceRef),
    subjectIds,
    completedIds: subjectIds
  });
}
function evaluateHandoffIntent(state, input) {
  assertV2State(state);
  if (!nonEmpty(input.intentEvidenceRef) || !Array.isArray(input.actions)) throw new Error("Handoff intent requires explicit action set and evidence reference.");
  const ids = input.actions.map((action) => action.id);
  assertUniqueNonEmpty(ids, "handoff action IDs");
  for (const action of input.actions) {
    if (action.stateRevision !== state.revision || !nonEmpty(action.observedFingerprint) || !nonEmpty(action.evidenceRef) || !["required", "selected", "not_selected"].includes(action.disposition)) throw new Error(`Handoff intent observation ${String(action.id)} is stale or malformed.`);
  }
  const selected = input.actions.filter((action) => action.disposition !== "not_selected").map((action) => action.id);
  if (input.delivery === "local" && selected.length) throw new Error("Local handoff intent cannot contain required or selected external actions.");
  if (input.delivery === "external" && !selected.length) throw new Error("External handoff intent requires at least one required or selected action.");
  if (input.delivery !== "local" && input.delivery !== "external") throw new Error("Unknown handoff delivery intent.");
  return createEvaluatorEvidence(state, "handoff_intent_resolved", "repository-observation", {
    evaluator: "handoff_intent",
    outcome: input.delivery === "local" ? "local_only" : "external_selected",
    inputDigest: digest(input),
    evidenceRefs: [input.intentEvidenceRef, ...input.actions.map((item) => item.evidenceRef)],
    subjectIds: ids,
    completedIds: selected
  });
}
function evaluateHandoffReconciliation(state, intent, input) {
  assertV2State(state);
  if (!trustedEvaluatorEvidence.has(intent) || intent.guard !== "handoff_intent_resolved") {
    throw new Error("Handoff reconciliation requires intent from trusted evaluator in current runtime.");
  }
  validateGuardEvidence(state, intent);
  const intentReceipt = intent.evaluatorReceipt;
  if (!intentReceipt || intentReceipt.evaluator !== "handoff_intent" || intentReceipt.outcome !== "external_selected") {
    throw new Error("Handoff reconciliation requires external handoff intent.");
  }
  const selectedIds = [...intentReceipt.completedIds];
  const observationIds = input.observations.map((item) => item.actionId);
  assertSameIds(selectedIds, observationIds, "handoff reconciliation actions");
  const completed = [];
  for (const observation of input.observations) {
    if (observation.stateRevision !== state.revision || !nonEmpty(observation.observedFingerprint) || !nonEmpty(observation.evidenceRef) || !["completed", "pending", "blocked"].includes(observation.status)) throw new Error(`Handoff observation ${String(observation.actionId)} is stale or malformed.`);
    if (observation.status === "completed") {
      if (!nonEmpty(observation.receiptRef)) throw new Error(`Completed handoff action ${observation.actionId} requires receiptRef.`);
      completed.push(observation.actionId);
    } else if (observation.receiptRef !== void 0) {
      throw new Error(`Incomplete handoff action ${observation.actionId} cannot contain receiptRef.`);
    }
  }
  return createEvaluatorEvidence(state, "handoff_reconciled", "repository-observation", {
    evaluator: "handoff_reconciliation",
    outcome: completed.length === selectedIds.length ? "complete" : "action_required",
    inputDigest: digest({ intentReceiptDigest: intentReceipt.receiptDigest, ...input }),
    evidenceRefs: input.observations.flatMap((item) => [item.evidenceRef, ...item.receiptRef ? [item.receiptRef] : []]),
    subjectIds: selectedIds,
    completedIds: completed
  });
}
function evaluateCriticalCompletionApproval(state, decision) {
  assertV2State(state);
  if (state.status !== "awaiting_approval" || state.mode !== "critical" || state.pendingGate !== "critical_completion") {
    throw new Error("Critical completion evaluator requires Critical completion gate.");
  }
  if (decision.decision !== "approved" || decision.gate !== "critical_completion" || decision.stateRevision !== state.revision || decision.stateFingerprint !== guardStateFingerprint(state) || decision.contractDigest !== state.contractDigest || !nonEmpty(decision.evidenceRef)) throw new Error("Critical completion approval is stale, malformed, or not approved.");
  const gateEntry = [...state.history].reverse().find(
    (event) => isTransitionEvent(event) && event.from === "verifying" && event.to === "awaiting_approval" && event.gateContext === "critical_completion" && event.contractDigest === state.contractDigest
  );
  const compactedGate = state.historySummary?.activeGate;
  const entryVerification = gateEntry?.guardEvidence?.find((item) => item.guard === "verification_complete");
  const verificationReceipt = entryVerification?.evaluatorReceipt ?? (compactedGate?.gateContext === "critical_completion" && compactedGate.contractDigest === state.contractDigest ? compactedGate.verificationReceipt : void 0);
  if (!verificationReceipt || verificationReceipt.evaluator !== "verification") {
    throw new Error("Critical completion gate lacks trusted verification receipt.");
  }
  if (entryVerification) validateEvaluatorReceipt(entryVerification, gateEntry?.sourceFingerprint, gateEntry ? gateEntry.revision - 1 : -1);
  else if (compactedGate) validateCompactedVerificationReceipt(compactedGate);
  return createEvaluatorEvidence(state, "critical_completion_approved", "human-approval", {
    evaluator: "critical_completion",
    outcome: "approved",
    inputDigest: digest({ decision, verificationReceiptDigest: verificationReceipt.receiptDigest }),
    evidenceRefs: [decision.evidenceRef, verificationReceipt.receiptDigest],
    subjectIds: [verificationReceipt.inputDigest],
    completedIds: [decision.evidenceRef]
  });
}
function createGateDecision(state, input) {
  assertV2State(state);
  if (state.status !== "awaiting_approval" || !state.pendingGate) throw new Error("Gate decision requires awaiting_approval with pendingGate.");
  if (!nonEmpty(input.evidenceRef) || !nonEmpty(state.contractDigest)) throw new Error("Gate decision requires evidenceRef and state-bound contractDigest.");
  return {
    schemaVersion: 1,
    gate: state.pendingGate,
    decision: input.decision,
    stateRevision: state.revision,
    stateFingerprint: guardStateFingerprint(state),
    evidenceRef: input.evidenceRef,
    contractDigest: state.contractDigest
  };
}
function addRoutingDecision(state, decision) {
  assertV2State(state);
  return { ...state, routingDecisions: [...state.routingDecisions ?? [], decision] };
}
function recordHistoryEvent(state, input) {
  assertV2State(state);
  if (STATE_MACHINE[state.status].terminal) throw new Error("Terminal state history is immutable.");
  const eventType = input.type;
  if (!WORKFLOW_EVENT_TYPES.has(eventType) || eventType === "task.created" || eventType === "state.migrated") {
    throw new Error(`Unsupported workflow history event type ${String(input.type)}.`);
  }
  validateHistoryReferences(input.refs, `Workflow event ${eventType}`);
  const normalized = normalizeHistoryEnvelope(state);
  const event = {
    sequence: nextHistorySequence(normalized),
    at: normalizeEventAt(input.at),
    type: input.type,
    refs: copy2(input.refs)
  };
  const output = withCompactedHistory(normalized, [...normalized.history, event]);
  assertV2State(output);
  return output;
}
function updateResumeContext(state, input) {
  assertV2State(state);
  if (STATE_MACHINE[state.status].terminal) throw new Error("Terminal state resume context is immutable.");
  const { activeArtifact: _activeArtifact, activeWorktree: _activeWorktree, ...base } = state;
  const updated = {
    ...base,
    remainingActions: input.remainingActions === void 0 ? [...state.remainingActions] : [...input.remainingActions],
    ...input.activeArtifact === void 0 ? state.activeArtifact ? { activeArtifact: copy2(state.activeArtifact) } : {} : input.activeArtifact === null ? {} : { activeArtifact: copy2(input.activeArtifact) },
    ...input.activeWorktree === void 0 ? state.activeWorktree ? { activeWorktree: copy2(state.activeWorktree) } : {} : input.activeWorktree === null ? {} : { activeWorktree: copy2(input.activeWorktree) },
    contextCapsule: input.contextCapsule === void 0 ? copy2(state.contextCapsule ?? defaultContextCapsule(state.configSnapshot, state.policySnapshot)) : copy2(input.contextCapsule)
  };
  const refs = [{ kind: "context-capsule", ref: "state:contextCapsule" }];
  if (updated.activeArtifact) refs.push({ kind: "artifact", ref: "state:activeArtifact", fingerprint: `sha256:${digest(updated.activeArtifact.fingerprint)}` });
  if (updated.activeWorktree) refs.push({ kind: "worktree", ref: "state:activeWorktree", fingerprint: `sha256:${digest(updated.activeWorktree.gitFingerprint)}` });
  return recordHistoryEvent(updated, { type: "context.updated", refs, ...input.at === void 0 ? {} : { at: input.at } });
}
function transition(state, next, options = {}) {
  assertV2State(state);
  validateTransitionOptionKeys(options);
  if (!isTaskStatus(next)) throw new Error(`Invalid state transition from ${state.status} to ${String(next)}.`);
  const contract = transitionContract(state.status, next);
  if (!contract) throw new Error(`Invalid state transition from ${state.status} to ${next}.`);
  if (!contract.modes.includes(state.mode)) throw new Error(`Transition ${state.status} to ${next} is not allowed for mode ${state.mode}.`);
  if (state.status === "verifying" && next === "awaiting_approval" && state.mode !== "critical") {
    throw new Error("Only Critical verification may enter the completion gate.");
  }
  const required2 = requiredGuards(state, contract);
  validateOptionApplicability(state, next, options, required2);
  const structural = validateStructuralGuards(state, next, options, required2);
  const evidenceByGuard = validateEvidenceSet(state, options.guardEvidence ?? [], required2);
  const missing = required2.filter((guard) => !structural.has(guard) && !evidenceByGuard.has(guard));
  if (missing.length) throw new Error(`Unmet transition guards from ${state.status} to ${next}: ${missing.join(", ")}.`);
  validateTrustedTarget(state, next, evidenceByGuard);
  const revision = state.revision + 1;
  const normalized = normalizeHistoryEnvelope(state);
  const gateContext = transitionGateContext(state, next);
  const contractDigest = transitionContractDigest(state, next, options);
  const event = {
    sequence: nextHistorySequence(normalized),
    at: normalizeEventAt(options.at),
    type: "state.transition",
    from: state.status,
    to: next,
    mode: state.mode,
    revision,
    sourceFingerprint: guardStateFingerprint(state),
    ...gateContext ? { gateContext } : {},
    ...contractDigest ? { contractDigest } : {},
    ...options.guardEvidence?.length ? { guardEvidence: options.guardEvidence.map((evidence) => copy2(evidence)) } : {},
    ...options.gateDecision ? { gateDecision: copy2(options.gateDecision) } : {},
    ...next === "cancelled" || next === "failed" ? {
      terminalSource: state.status,
      ...state.status === "blocked" && state.resumeTo ? { terminalResumeTo: state.resumeTo } : {}
    } : {}
  };
  const { resumeTo: _resumeTo, pendingGate: _pendingGate, ...base } = state;
  const metadata = transitionMetadata(state, next, options);
  const output = {
    ...base,
    status: next,
    revision,
    modeConfirmed: state.modeConfirmed || state.status === "awaiting_mode_confirmation" && (next === "executing" || next === "discovering"),
    ...metadata,
    history: normalized.history
  };
  const compacted = withCompactedHistory(output, [...normalized.history, event]);
  assertV2State(compacted);
  return compacted;
}
function transitionGateContext(state, next) {
  if (state.pendingGate && (state.status === "awaiting_approval" || state.status === "blocked" || next === "blocked" || next === "awaiting_approval")) return state.pendingGate;
  if (next === "awaiting_approval" && state.status === "planning") return "pre_build";
  if (next === "awaiting_approval" && state.status === "verifying") return "critical_completion";
  return void 0;
}
function transitionContractDigest(state, next, options) {
  if (next === "awaiting_approval" && state.status === "planning") return options.contractDigest;
  if (state.contractDigest && (state.pendingGate || state.status === "awaiting_approval" || state.status === "blocked" || next === "awaiting_approval" || next === "blocked")) return state.contractDigest;
  return void 0;
}
function transitionMetadata(state, next, options) {
  if (next === "blocked") {
    return {
      resumeTo: options.resumeTo,
      remainingActions: [...options.remainingActions ?? []],
      ...state.pendingGate ? { pendingGate: state.pendingGate } : {},
      ...state.contractDigest ? { contractDigest: state.contractDigest } : {}
    };
  }
  if (next === "ready_for_handoff") {
    return { resumeTo: "handing_off", remainingActions: [...options.remainingActions ?? []] };
  }
  if (next === "awaiting_approval") {
    const gate = state.status === "planning" ? "pre_build" : state.status === "verifying" ? "critical_completion" : state.pendingGate;
    if (!gate) throw new Error("awaiting_approval requires deterministic pendingGate context.");
    const digest3 = state.status === "planning" ? options.contractDigest : state.contractDigest;
    if (!nonEmpty(digest3)) throw new Error("awaiting_approval requires contractDigest bound to current contract.");
    return { pendingGate: gate, contractDigest: digest3, remainingActions: [] };
  }
  return { remainingActions: [] };
}
function transitionContract(from, to) {
  return STATE_MACHINE[from].transitions[to];
}
function requiredGuards(state, contract) {
  return [
    ...contract.guards,
    ...contract.conditionalGuards.filter((conditional) => conditional.when.mode === state.mode).map((conditional) => conditional.guard)
  ];
}
function validateStructuralGuards(state, next, options, required2) {
  const satisfied = /* @__PURE__ */ new Set();
  if (required2.includes("task_initialized")) {
    if (!nonEmpty(state.taskId) || !isRecord6(state.configSnapshot) || !isRecord6(state.policySnapshot)) throw new Error("task_initialized failed.");
    satisfied.add("task_initialized");
  }
  if (required2.includes("resume_metadata_valid")) {
    if (next === "blocked") {
      if (!options.resumeTo || !options.remainingActions?.length) throw new Error("blocked requires resumeTo and remainingActions.");
      if (!isOperationalResumeTarget(options.resumeTo)) throw new Error(`blocked requires operational, non-stable resumeTo; received ${options.resumeTo}.`);
      if (options.resumeTo === "awaiting_approval" && (!state.pendingGate || !state.contractDigest)) throw new Error("blocked resumeTo awaiting_approval requires existing pendingGate and contractDigest.");
      if (state.pendingGate && options.resumeTo !== "awaiting_approval") throw new Error("blocked state with pendingGate must resume to awaiting_approval.");
    } else if (state.status === "blocked") {
      if (!state.resumeTo || !state.remainingActions.length || !isOperationalResumeTarget(state.resumeTo)) throw new Error("blocked state has invalid resume metadata.");
      if (next !== state.resumeTo) throw new Error(`blocked may transition only to exact resumeTo ${state.resumeTo}.`);
    } else {
      throw new Error(`resume_metadata_valid is not applicable from ${state.status} to ${next}.`);
    }
    satisfied.add("resume_metadata_valid");
  }
  if (required2.includes("terminal_source_recorded")) {
    if (options.terminalSource !== state.status) throw new Error(`${next} requires terminalSource equal to current status ${state.status}.`);
    satisfied.add("terminal_source_recorded");
  }
  if (required2.includes("gate_context_valid")) {
    validateGateContext(state, next, options.gateDecision);
    satisfied.add("gate_context_valid");
  }
  if (next === "ready_for_handoff" && !options.remainingActions?.length) throw new Error("ready_for_handoff requires remainingActions.");
  return satisfied;
}
function validateGateContext(state, next, decision) {
  if (state.status !== "awaiting_approval" || !state.pendingGate || !decision) throw new Error("Gate exit requires pendingGate and bound gateDecision.");
  if (decision.schemaVersion !== 1 || decision.gate !== state.pendingGate || decision.stateRevision !== state.revision || decision.stateFingerprint !== guardStateFingerprint(state) || !nonEmpty(decision.evidenceRef) || !nonEmpty(decision.contractDigest) || decision.contractDigest !== state.contractDigest) throw new Error("Gate decision is stale, malformed, or bound to another state.");
  if (!gateDecisionAllows(decision.gate, decision.decision, next)) throw new Error(`Gate ${state.pendingGate} decision ${decision.decision} cannot transition to ${next}.`);
}
function gateDecisionAllows(gate, decision, target) {
  const approvedTargets = {
    pre_build: ["executing"],
    critical_completion: ["handing_off", "ready_for_handoff", "finished_local"]
  };
  const rejectedTargets = {
    pre_build: ["planning"],
    critical_completion: ["resolving_assure", "verifying"]
  };
  return (decision === "approved" ? approvedTargets[gate] : rejectedTargets[gate]).includes(target);
}
function validateEvidenceSet(state, evidence, required2) {
  const output = /* @__PURE__ */ new Map();
  for (const item of evidence) {
    validateGuardEvidence(state, item);
    if (!required2.includes(item.guard) || STRUCTURAL_GUARDS.has(item.guard)) throw new Error(`Guard evidence for ${item.guard} is not applicable to this transition.`);
    if (TRUSTED_EVALUATOR_REQUIRED.has(item.guard) && !trustedEvaluatorEvidence.has(item)) {
      throw new Error(`Guard ${item.guard} requires trusted evaluator evidence from current runtime.`);
    }
    if (output.has(item.guard)) throw new Error(`Duplicate guard evidence for ${item.guard}.`);
    output.set(item.guard, item);
  }
  return output;
}
function validateOptionApplicability(state, next, options, required2) {
  const terminal = next === "cancelled" || next === "failed";
  if (options.terminalSource !== void 0 && !terminal) throw new Error("terminalSource is valid only for cancelled or failed transitions.");
  if (options.resumeTo !== void 0 && next !== "blocked") throw new Error("resumeTo is valid only when entering blocked.");
  if (options.remainingActions !== void 0 && next !== "blocked" && next !== "ready_for_handoff") throw new Error("remainingActions is valid only for blocked or ready_for_handoff.");
  if (options.gateDecision !== void 0 && !required2.includes("gate_context_valid")) throw new Error("gateDecision is valid only when exiting awaiting_approval.");
  if (options.contractDigest !== void 0 && next !== "awaiting_approval") throw new Error("contractDigest is valid only when entering awaiting_approval.");
  if (options.contractDigest !== void 0 && state.status !== "planning") throw new Error("contractDigest may be supplied only by planning entering pre-build gate.");
  if (options.contractDigest !== void 0 && state.verificationRequirements && state.verificationRequirements.sourceDigest !== options.contractDigest) {
    throw new Error("Pre-build contractDigest does not match state-bound verification requirements.");
  }
}
function validateGuardEvidence(state, evidence) {
  if (evidence.schemaVersion !== 1 || !GUARD_IDS.includes(evidence.guard) || evidence.stateRevision !== state.revision || evidence.stateFingerprint !== guardStateFingerprint(state) || !nonEmpty(evidence.observedFingerprint) || !Array.isArray(evidence.evidenceRefs) || !evidence.evidenceRefs.length || !evidence.evidenceRefs.every(nonEmpty) || !["deterministic-check", "human-approval", "repository-observation"].includes(evidence.provenance) || !["passed", "not_applicable"].includes(evidence.result)) throw new Error(`Guard evidence for ${String(evidence.guard)} is stale, malformed, or unproven.`);
  if (evidence.result === "not_applicable" && evidence.guard !== "review_satisfied") {
    throw new Error(`Guard ${evidence.guard} cannot be attested not_applicable.`);
  }
  if (TRUSTED_EVALUATOR_REQUIRED.has(evidence.guard)) validateEvaluatorReceipt(evidence, guardStateFingerprint(state), state.revision);
  else if (evidence.evaluatorReceipt !== void 0) throw new Error(`Guard ${evidence.guard} cannot contain evaluatorReceipt.`);
}
function validateTransitionOptionKeys(options) {
  const allowed = /* @__PURE__ */ new Set(["resumeTo", "remainingActions", "terminalSource", "guardEvidence", "gateDecision", "contractDigest", "at"]);
  const unknown = Object.keys(options).filter((key) => !allowed.has(key));
  if (unknown.length) throw new Error(`Unknown transition options: ${unknown.join(", ")}.`);
}
function createEvaluatorEvidence(state, guard, provenance, input) {
  const receiptBase = {
    schemaVersion: 1,
    ...input,
    stateRevision: state.revision,
    stateFingerprint: guardStateFingerprint(state)
  };
  const receipt = { ...receiptBase, receiptDigest: digest(receiptBase) };
  const evidence = deepFreezeValue({
    schemaVersion: 1,
    guard,
    stateRevision: state.revision,
    stateFingerprint: guardStateFingerprint(state),
    observedFingerprint: receipt.receiptDigest,
    evidenceRefs: [...receipt.evidenceRefs],
    provenance,
    result: "passed",
    evaluatorReceipt: receipt
  });
  validateGuardEvidence(state, evidence);
  trustedEvaluatorEvidence.add(evidence);
  return evidence;
}
function validateEvaluatorReceipt(evidence, expectedFingerprint, expectedRevision) {
  const receipt = evidence.evaluatorReceipt;
  const expectedEvaluator = {
    intake_complete: "intake",
    verification_complete: "verification",
    handoff_intent_resolved: "handoff_intent",
    handoff_reconciled: "handoff_reconciliation",
    critical_completion_approved: "critical_completion"
  };
  if (!receipt || receipt.schemaVersion !== 1 || receipt.evaluator !== expectedEvaluator[evidence.guard] || receipt.stateRevision !== expectedRevision || receipt.stateFingerprint !== expectedFingerprint || evidence.observedFingerprint !== receipt.receiptDigest || !nonEmpty(receipt.inputDigest) || !Array.isArray(receipt.evidenceRefs) || !receipt.evidenceRefs.length || !receipt.evidenceRefs.every(nonEmpty) || !Array.isArray(receipt.subjectIds) || !Array.isArray(receipt.completedIds)) throw new Error(`Trusted evaluator receipt for ${evidence.guard} is stale or malformed.`);
  if (!sameIds(evidence.evidenceRefs, receipt.evidenceRefs)) throw new Error(`Trusted evaluator receipt for ${evidence.guard} has mismatched evidence references.`);
  assertUniqueNonEmpty(receipt.subjectIds, "evaluator subject IDs");
  assertUniqueNonEmpty(receipt.completedIds, "evaluator completed IDs", true);
  const { receiptDigest, ...base } = receipt;
  if (receiptDigest !== digest(base)) throw new Error(`Trusted evaluator receipt for ${evidence.guard} has invalid digest.`);
  if (receipt.evaluator === "intake" && (receipt.outcome !== "intake_complete" || !sameIds(receipt.subjectIds, ["objective", "success_signal", "mode", "risk"]) || !sameIds(receipt.subjectIds, receipt.completedIds))) throw new Error("Intake evaluator receipt is incomplete.");
  if (receipt.evaluator === "verification" && (receipt.outcome !== "complete" || !sameIds(receipt.subjectIds, receipt.completedIds) || !receipt.subjectIds.length)) {
    throw new Error("Verification evaluator receipt does not prove complete coverage.");
  }
  if (receipt.evaluator === "handoff_intent") {
    if (receipt.outcome === "local_only" && receipt.completedIds.length) throw new Error("Local handoff evaluator receipt selects external actions.");
    if (receipt.outcome === "external_selected" && !receipt.completedIds.length) throw new Error("External handoff evaluator receipt selects no action.");
    if (receipt.outcome !== "local_only" && receipt.outcome !== "external_selected") throw new Error("Handoff intent evaluator receipt has invalid outcome.");
    if (!receipt.completedIds.every((id) => receipt.subjectIds.includes(id))) throw new Error("Handoff intent evaluator receipt contains unknown selected action.");
  }
  if (receipt.evaluator === "handoff_reconciliation") {
    if (!receipt.subjectIds.length || !receipt.completedIds.every((id) => receipt.subjectIds.includes(id))) throw new Error("Handoff reconciliation evaluator receipt contains unknown action.");
    if (receipt.outcome === "complete" && !sameIds(receipt.subjectIds, receipt.completedIds)) throw new Error("Complete handoff receipt lacks completed actions.");
    if (receipt.outcome === "action_required" && sameIds(receipt.subjectIds, receipt.completedIds)) throw new Error("Action-required handoff receipt has no remaining action.");
    if (receipt.outcome !== "complete" && receipt.outcome !== "action_required") throw new Error("Handoff reconciliation evaluator receipt has invalid outcome.");
  }
  if (receipt.evaluator === "critical_completion" && (receipt.outcome !== "approved" || receipt.subjectIds.length !== 1 || receipt.completedIds.length !== 1)) {
    throw new Error("Critical completion evaluator receipt is incomplete.");
  }
}
function validateTrustedTarget(state, next, evidence) {
  const intent = evidence.get("handoff_intent_resolved")?.evaluatorReceipt;
  if (next === "finished_local" && intent?.outcome !== "local_only") throw new Error("finished_local requires local-only handoff intent.");
  if (["handing_off", "ready_for_handoff", "finished"].includes(next) && intent && intent.outcome !== "external_selected") {
    throw new Error(`${next} requires external-selected handoff intent.`);
  }
  const reconciliation = evidence.get("handoff_reconciled")?.evaluatorReceipt;
  if (intent && reconciliation && !sameIds(intent.completedIds, reconciliation.subjectIds)) {
    throw new Error("Handoff reconciliation does not match selected intent actions.");
  }
  if (next === "finished" && reconciliation?.outcome !== "complete") throw new Error("finished requires complete handoff reconciliation.");
  if ((next === "ready_for_handoff" || state.status === "ready_for_handoff" && next === "handing_off") && reconciliation?.outcome !== "action_required") {
    throw new Error(`${next} requires action-required handoff reconciliation.`);
  }
  const critical = evidence.get("critical_completion_approved")?.evaluatorReceipt;
  const verification = evidence.get("verification_complete")?.evaluatorReceipt;
  if (critical && verification && critical.subjectIds[0] !== verification.inputDigest) {
    throw new Error("Critical completion approval does not match current verification projection.");
  }
}
function assertExactObservations(state, label, requiredIds, observations, requireNonEmpty) {
  assertUniqueNonEmpty(requiredIds, `${label} required IDs`, !requireNonEmpty);
  if (!Array.isArray(observations)) throw new Error(`${label} observations must be an array.`);
  assertSameIds(requiredIds, observations.map((item) => item.id), label);
  for (const item of observations) {
    if (item.stateRevision !== state.revision) throw new Error(`${label} observation ${String(item.id)} is stale.`);
    if (!nonEmpty(item.observedFingerprint) || !nonEmpty(item.evidenceRef)) throw new Error(`${label} observation ${String(item.id)} is malformed.`);
    if (!Number.isInteger(item.exitCode)) throw new Error(`${label} observation ${String(item.id)} is malformed.`);
    if (item.exitCode !== 0) throw new Error(`${label} observation ${item.id} did not pass.`);
  }
}
function assertSameIds(expected, actual, label) {
  assertUniqueNonEmpty(actual, `${label} observed IDs`, expected.length === 0);
  if (!sameIds(expected, actual)) throw new Error(`${label} do not exactly cover required IDs.`);
}
function sameIds(left, right) {
  return left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
}
function assertUniqueNonEmpty(values, label, allowEmpty = false) {
  if (!Array.isArray(values) || !allowEmpty && !values.length || !values.every(nonEmpty) || new Set(values).size !== values.length) {
    throw new Error(`${label} must contain unique non-empty values${allowEmpty ? "" : " and cannot be empty"}.`);
  }
}
function validateVerificationRequirements(value) {
  if (value.schemaVersion !== 1 || !nonEmpty(value.sourceDigest) || !nonEmpty(value.requirementsDigest)) throw new Error("verificationRequirements is malformed.");
  assertUniqueNonEmpty(value.criterionIds, "verification criterion IDs");
  assertUniqueNonEmpty(value.mandatoryCheckIds, "verification mandatory check IDs", true);
  if (value.requirementsDigest !== digest({ criterionIds: value.criterionIds, mandatoryCheckIds: value.mandatoryCheckIds })) {
    throw new Error("verificationRequirements digest does not match required IDs.");
  }
}
function validateCompleteIntake(state) {
  const intake = state.intake;
  const signal = intake?.brief.successSignal;
  if (!intake || !intake.semanticComplete || !intake.deterministicComplete || intake.activeQuestion !== void 0 || intake.contradictions.length > 0 || intake.blockedReason !== void 0 || !nonEmpty(intake.brief.objective) || !signal || !nonEmpty(signal.description) || !nonEmpty(signal.observationMethod) || intake.brief.mode !== state.mode || !["low", "medium", "high", "critical"].includes(intake.brief.risk) || intake.brief.technicalUnknowns.some((unknown) => !nonEmpty(unknown.key) || !["code", "dependency", "architecture", "validation", "operations"].includes(unknown.kind) || !nonEmpty(unknown.description) || unknown.owner !== "shape")) throw new Error("intake_complete requires semantically and deterministically complete Intake Brief.");
}
function digest(value) {
  return createHash("sha256").update(stable(value)).digest("hex");
}
function deepFreezeValue(value) {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreezeValue(nested);
  return Object.freeze(value);
}
function migrateStateToV2(value, options = {}) {
  if (!isRecord6(value) || !Number.isInteger(value.schemaVersion)) throw unsupported("State schemaVersion is missing or unsupported");
  if (value.schemaVersion === 2) {
    assertV2State(value);
    return { state: copy2(value), migrationRequired: false };
  }
  if (value.schemaVersion !== 1) throw unsupported(`State schemaVersion ${String(value.schemaVersion)} is unsupported`);
  validateV1State(value);
  const source = copy2(value);
  const rawHistory = source.history;
  if (["handing_off", "ready_for_handoff", "finished_local", "finished"].includes(source.status) || ["handing_off", "ready_for_handoff"].includes(source.resumeTo)) {
    throw ambiguous(`V1 ${source.status} lacks V2 verification evidence and requires reverification`);
  }
  const { mode, evidenceRef, confirmed } = inferMigrationMode(rawHistory, options);
  const migratedTransitions = migrateHistory(rawHistory, mode);
  const fullHistory = [
    {
      sequence: 1,
      at: migrationEventAt(1),
      type: "task.created",
      refs: [{ kind: "task", ref: "state:taskId" }, { kind: "migration-source", ref: "state:v1" }]
    },
    ...migratedTransitions,
    {
      sequence: migratedTransitions.length + 2,
      at: migrationEventAt(migratedTransitions.length + 2),
      type: "state.migrated",
      refs: [{ kind: "migration-source", ref: "state:v1" }, { kind: "migration-target", ref: "state:v2" }]
    }
  ];
  const rawStatus = source.status;
  const status = mapCurrentV1Status(rawStatus, rawHistory);
  const rawResumeTo = source.resumeTo;
  const resumeTo = rawStatus === "blocked" && rawResumeTo === "resolving" ? inferResolvingStatus(rawHistory, true) : rawStatus === "ready_for_handoff" ? "handing_off" : rawResumeTo === void 0 ? void 0 : mapV1OrdinaryStatus(rawResumeTo);
  const {
    schemaVersion: _schemaVersion,
    status: _status,
    resumeTo: _resumeTo,
    history: _history,
    ...preserved
  } = source;
  const migrated = {
    ...preserved,
    schemaVersion: 2,
    status,
    revision: migratedTransitions.length,
    mode,
    modeEvidenceRef: evidenceRef,
    modeConfirmed: confirmed,
    ...resumeTo ? { resumeTo } : {},
    contextCapsule: defaultContextCapsule(source.configSnapshot, source.policySnapshot),
    history: fullHistory
  };
  const compacted = withCompactedHistory(migrated, fullHistory);
  assertV2State(compacted);
  return { state: compacted, migrationRequired: true };
}
var V1_STATUSES = [
  "new",
  "awaiting_mode_confirmation",
  "discovering",
  "planning",
  "awaiting_approval",
  "executing",
  "validating",
  "reviewing",
  "resolving",
  "verifying",
  "handing_off",
  "ready_for_handoff",
  "blocked",
  "cancelled",
  "failed",
  "finished_local",
  "finished"
];
var V1_ALLOWED = {
  new: ["awaiting_mode_confirmation"],
  awaiting_mode_confirmation: ["executing", "discovering", "cancelled"],
  discovering: [],
  planning: [],
  awaiting_approval: [],
  executing: ["validating", "blocked"],
  validating: ["reviewing", "verifying", "resolving"],
  reviewing: ["resolving", "verifying"],
  resolving: ["validating", "blocked"],
  verifying: ["handing_off", "finished_local", "ready_for_handoff", "resolving"],
  handing_off: ["finished", "ready_for_handoff"],
  ready_for_handoff: [],
  blocked: [],
  cancelled: [],
  failed: [],
  finished_local: [],
  finished: []
};
function validateV1State(value) {
  const allowedKeys = /* @__PURE__ */ new Set([
    "schemaVersion",
    "taskId",
    "status",
    "resumeTo",
    "configSnapshot",
    "policySnapshot",
    "issues",
    "reviewCycle",
    "remainingActions",
    "history",
    "routingSnapshot",
    "routingPolicyVersion",
    "routingDecisions"
  ]);
  const unknown = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (unknown.length) throw invalid2(`V1 state contains unknown properties: ${unknown.join(", ")}`);
  if (typeof value.taskId !== "string" || !value.taskId || !isV1Status(value.status) || !isRecord6(value.configSnapshot) || !isRecord6(value.policySnapshot) || !Array.isArray(value.issues) || !Number.isInteger(value.reviewCycle) || value.reviewCycle < 0 || !Array.isArray(value.remainingActions) || !value.remainingActions.every(nonEmpty) || !Array.isArray(value.history)) throw invalid2("V1 state does not satisfy required V1 fields");
  if (value.resumeTo !== void 0 && !isV1Status(value.resumeTo)) throw invalid2("V1 resumeTo is invalid");
  if (value.status === "blocked") {
    const operationalV1 = ["new", "awaiting_mode_confirmation", "discovering", "planning", "awaiting_approval", "executing", "validating", "reviewing", "resolving", "verifying", "handing_off"];
    if (!operationalV1.includes(value.resumeTo)) throw invalid2("V1 blocked resumeTo must be operational");
  } else if (value.status === "ready_for_handoff") {
    if (value.resumeTo !== "handing_off") throw invalid2("V1 ready_for_handoff resumeTo must be handing_off");
  } else if (value.resumeTo !== void 0) {
    throw invalid2(`V1 ${value.status} must not contain resumeTo`);
  }
  const history = value.history;
  if (value.status === "new") {
    if (history.length) throw invalid2("V1 new state must have empty history");
    return;
  }
  if (!history.length) throw invalid2(`V1 ${value.status} cannot migrate without complete transition history`);
  let previousTo;
  for (const [index, raw] of history.entries()) {
    if (!isLegacyTransition(raw)) throw invalid2(`V1 history event ${index} is not a recognized transition`);
    if (index === 0 && raw.from !== "new") throw invalid2("V1 history must start from new");
    if (previousTo !== void 0 && raw.from !== previousTo) throw invalid2(`V1 history breaks continuity at event ${index}`);
    if (!V1_ALLOWED[raw.from].includes(raw.to)) throw invalid2(`V1 history edge ${raw.from} -> ${raw.to} is illegal`);
    previousTo = raw.to;
  }
  if (previousTo !== value.status) throw invalid2(`V1 latest history status ${String(previousTo)} does not match current ${value.status}`);
  if (value.status === "blocked" && (!isV1Status(value.resumeTo) || !value.remainingActions.length)) throw invalid2("V1 blocked requires resumeTo and remainingActions");
  if (value.status === "ready_for_handoff" && !value.remainingActions.length) throw invalid2("V1 ready_for_handoff requires remainingActions");
}
function inferMigrationMode(history, options) {
  const exit = history.find((event) => event.from === "awaiting_mode_confirmation");
  const inferred = exit?.to === "executing" ? "quick" : void 0;
  const confirmed = exit?.to === "executing" || exit?.to === "discovering";
  if (inferred) {
    if (options.mode && options.mode !== inferred) throw ambiguous(`Migration mode ${options.mode} contradicts Quick history`);
    return { mode: inferred, evidenceRef: options.modeEvidenceRef ?? "migration:history:quick", confirmed };
  }
  if (!options.mode || !nonEmpty(options.modeEvidenceRef)) throw ambiguous("V1 mode cannot be inferred uniquely; provide mode with modeEvidenceRef");
  if (exit?.to === "discovering" && options.mode === "quick") throw ambiguous("Quick mode contradicts V1 discovery history");
  return { mode: options.mode, evidenceRef: options.modeEvidenceRef, confirmed };
}
function migrateHistory(history, mode) {
  let resolvingContext;
  return history.map((raw, index) => {
    const from = raw.from === "resolving" ? resolvingContext : mapV1OrdinaryStatus(raw.from);
    if (!from) throw ambiguous(`V1 history event ${index} leaves resolving source ambiguous`);
    let to;
    if (raw.to === "resolving") {
      resolvingContext = splitResolvingSource(raw.from);
      to = resolvingContext;
    } else {
      to = mapV1OrdinaryStatus(raw.to);
    }
    const contract = transitionContract(from, to);
    if (!contract) throw invalid2(`Translated V1 edge ${from} -> ${to} is not canonical V2`);
    const legacyData = { migratedFromSchemaVersion: 1 };
    const migrationEvidence = [
      ...contract.guards,
      ...contract.conditionalGuards.filter((conditional) => conditional.when.mode === mode).map((conditional) => conditional.guard)
    ].filter((guard) => !STRUCTURAL_GUARDS.has(guard)).map((guard) => ({
      schemaVersion: 1,
      guard,
      stateRevision: index,
      stateFingerprint: `migration:v1:state:${index}`,
      observedFingerprint: `migration:v1:event:${index + 1}`,
      evidenceRefs: [`migration:v1:history:${index + 1}`],
      provenance: "migration-history",
      result: guard === "review_satisfied" ? "not_applicable" : "passed"
    }));
    return {
      sequence: index + 2,
      at: migrationEventAt(index + 2),
      type: "state.transition",
      from,
      to,
      mode,
      revision: index + 1,
      sourceFingerprint: `migration:v1:state:${index}`,
      ...migrationEvidence.length ? { guardEvidence: migrationEvidence } : {},
      ...to === "cancelled" || to === "failed" ? { terminalSource: from } : {},
      legacyData
    };
  });
}
function mapCurrentV1Status(status, history) {
  return status === "resolving" ? inferResolvingStatus(history, false) : mapV1OrdinaryStatus(status);
}
function inferResolvingStatus(history, blockedContext) {
  const event = blockedContext ? history.at(-2) : history.at(-1);
  if (!event || event.to !== "resolving") throw ambiguous("V1 resolving lacks coherent latest entry context");
  return splitResolvingSource(event.from);
}
function splitResolvingSource(source) {
  if (source === "validating") return "resolving_build";
  if (source === "reviewing" || source === "verifying") return "resolving_assure";
  throw ambiguous(`V1 resolving source ${source} does not identify BUILD or ASSURE`);
}
function mapV1OrdinaryStatus(value) {
  if (value === "resolving") throw ambiguous("V1 resolving requires history context");
  if (!isTaskStatus(value)) throw invalid2(`V1 status ${value} has no V2 mapping`);
  return value;
}
function assertV2State(value) {
  const schema = validateStateV2(value);
  if (!schema.valid) throw invalid2(`State V2 schema validation failed: ${formatSchemaError(schema.errors[0])}`);
  const state = value;
  if (state.verificationRequirements) {
    try {
      validateVerificationRequirements(state.verificationRequirements);
    } catch (error) {
      throw invalid2(error instanceof Error ? error.message : "verificationRequirements is invalid");
    }
  }
  if (state.contractDigest !== void 0 && state.verificationRequirements && state.contractDigest !== state.verificationRequirements.sourceDigest) {
    throw invalid2("Persisted contractDigest does not match state-bound verification requirements");
  }
  if (state.contextCapsule) validateContextCapsule(state.contextCapsule);
  if (state.activeArtifact && (!compactRef(state.activeArtifact.artifactId) || !compactRef(state.activeArtifact.ownerRef) || !compactRef(state.activeArtifact.fingerprint))) {
    throw invalid2("Active artifact reference is malformed");
  }
  if (state.activeWorktree && (!compactRef(state.activeWorktree.worktreeRef) || !compactRef(state.activeWorktree.gitFingerprint))) {
    throw invalid2("Active worktree reference is malformed");
  }
  validateHistoryEnvelope(state);
  const events = state.history.filter(isTransitionEvent);
  const compactedTransitions = state.historySummary?.typeCounts["state.transition"] ?? 0;
  if (state.revision !== compactedTransitions + events.length) throw invalid2("State V2 revision must equal total transition count");
  let previous = state.historySummary?.lastTransition?.to;
  let activeGate = state.historySummary?.activeGate?.gateContext;
  let activeGateDigest = state.historySummary?.activeGate?.contractDigest;
  let activeCriticalVerificationProjection = state.historySummary?.activeGate?.verificationReceipt?.inputDigest;
  for (const [index, event] of events.entries()) {
    if (event.revision !== compactedTransitions + index + 1) throw invalid2(`State V2 history revision is non-monotonic at event ${index}`);
    if (index === 0 && compactedTransitions === 0 && event.from !== "new") throw invalid2("State V2 history must start from new");
    if (previous !== void 0 && event.from !== previous) throw invalid2(`State V2 history breaks continuity at event ${index}`);
    if (!(event.to in STATE_MACHINE[event.from].transitions)) throw invalid2(`State V2 history edge ${event.from} -> ${event.to} is illegal`);
    const eventContract = transitionContract(event.from, event.to);
    const eventMode = event.mode ?? state.mode;
    if (!eventContract?.modes.includes(eventMode)) throw invalid2(`State V2 history edge ${event.from} -> ${event.to} is invalid for mode ${eventMode}`);
    if (!nonEmpty(event.sourceFingerprint)) throw invalid2(`State V2 event ${index} lacks sourceFingerprint`);
    if (event.guardEvidence) {
      const seen = /* @__PURE__ */ new Set();
      for (const evidence of event.guardEvidence) {
        if (evidence.stateRevision !== event.revision - 1 || seen.has(evidence.guard)) throw invalid2(`State V2 event ${index} contains stale or duplicate guard evidence`);
        if (evidence.result === "not_applicable" && evidence.guard !== "review_satisfied") throw invalid2(`State V2 event ${index} contains invalid not_applicable evidence`);
        if (evidence.stateFingerprint !== event.sourceFingerprint) throw invalid2(`State V2 event ${index} contains mismatched evidence stateFingerprint`);
        if (TRUSTED_EVALUATOR_REQUIRED.has(evidence.guard) && !(evidence.guard === "intake_complete" && evidence.provenance === "migration-history")) {
          try {
            validateEvaluatorReceipt(evidence, event.sourceFingerprint, event.revision - 1);
          } catch (error) {
            throw invalid2(error instanceof Error ? error.message : `State V2 event ${index} has invalid trusted evaluator receipt`);
          }
        } else if (evidence.evaluatorReceipt !== void 0) {
          throw invalid2(`State V2 event ${index} has evaluator receipt on untrusted guard ${evidence.guard}`);
        }
        seen.add(evidence.guard);
      }
    }
    const contract = transitionContract(event.from, event.to);
    if (!contract) throw invalid2(`State V2 history edge ${event.from} -> ${event.to} lacks contract`);
    const evidenceByGuard = new Map(event.guardEvidence?.map((evidence) => [evidence.guard, evidence]) ?? []);
    try {
      validateTrustedTarget({ ...state, status: event.from }, event.to, evidenceByGuard);
    } catch (error) {
      throw invalid2(error instanceof Error ? error.message : `State V2 event ${index} has invalid trusted target evidence`);
    }
    if (event.gateDecision) {
      if (event.gateDecision.stateRevision !== event.revision - 1 || event.gateDecision.stateFingerprint !== event.sourceFingerprint) throw invalid2(`State V2 event ${index} contains stale gate decision`);
      if (event.from !== "awaiting_approval" || event.gateContext !== event.gateDecision.gate || !gateDecisionAllows(event.gateDecision.gate, event.gateDecision.decision, event.to)) {
        throw invalid2(`State V2 event ${index} contains invalid gate decision context`);
      }
    } else if (contract.guards.includes("gate_context_valid")) {
      throw invalid2(`State V2 gate exit event ${index} lacks gate decision`);
    }
    if (event.to === "awaiting_approval") {
      const expectedGate = event.from === "planning" ? "pre_build" : event.from === "verifying" ? "critical_completion" : event.from === "blocked" ? event.gateContext : void 0;
      if (!expectedGate || event.gateContext !== expectedGate || !nonEmpty(event.contractDigest)) throw invalid2(`State V2 event ${index} lacks valid gate entry context`);
      if (event.from === "blocked" && activeGate !== void 0 && (event.gateContext !== activeGate || event.contractDigest !== activeGateDigest)) throw invalid2(`State V2 event ${index} changes blocked gate context`);
      activeGate = event.gateContext;
      activeGateDigest = event.contractDigest;
      if (event.from === "verifying") {
        activeCriticalVerificationProjection = evidenceByGuard.get("verification_complete")?.evaluatorReceipt?.inputDigest;
        if (!activeCriticalVerificationProjection) throw invalid2(`State V2 event ${index} lacks Critical verification projection`);
      }
    }
    if (event.from === "awaiting_approval") {
      if (activeGate !== void 0 && (event.gateContext !== activeGate || event.contractDigest !== activeGateDigest)) throw invalid2(`State V2 event ${index} gate digest/context differs from entry`);
      if (event.gateDecision && event.gateDecision.contractDigest !== event.contractDigest) throw invalid2(`State V2 event ${index} gate decision digest differs from event`);
      if (event.gateContext === "critical_completion" && event.to !== "blocked" && ["handing_off", "ready_for_handoff", "finished_local"].includes(event.to)) {
        const critical = evidenceByGuard.get("critical_completion_approved")?.evaluatorReceipt;
        if (!critical || activeCriticalVerificationProjection !== void 0 && critical.subjectIds[0] !== activeCriticalVerificationProjection || critical.completedIds[0] !== event.gateDecision?.evidenceRef) {
          throw invalid2(`State V2 event ${index} Critical approval does not match gate verification and decision`);
        }
      }
      if (event.to !== "blocked") {
        activeGate = void 0;
        activeGateDigest = void 0;
        activeCriticalVerificationProjection = void 0;
      }
    } else if (event.from === "blocked" && event.gateContext) {
      if (activeGate !== void 0 && (event.gateContext !== activeGate || event.contractDigest !== activeGateDigest)) throw invalid2(`State V2 event ${index} changes preserved gate context`);
      if (event.to !== "awaiting_approval" && event.to !== "blocked") {
        activeGate = void 0;
        activeGateDigest = void 0;
        activeCriticalVerificationProjection = void 0;
      }
    }
    const nonStructural = requiredGuards({ ...state, mode: eventMode }, contract).filter((guard) => !STRUCTURAL_GUARDS.has(guard));
    const recorded = new Set(event.guardEvidence?.map((evidence) => evidence.guard) ?? []);
    const missing = nonStructural.filter((guard) => !recorded.has(guard));
    if (missing.length) throw invalid2(`State V2 event ${index} lacks durable guard evidence: ${missing.join(", ")}`);
    const terminal = event.to === "cancelled" || event.to === "failed";
    if (terminal) {
      if (event.terminalSource !== event.from) throw invalid2("Terminal event source must equal from status");
      if (event.from === "blocked") {
        if (!event.terminalResumeTo || !isOperationalResumeTarget(event.terminalResumeTo)) throw invalid2("Blocked terminal event requires operational terminalResumeTo");
      } else if (event.terminalResumeTo !== void 0) throw invalid2("terminalResumeTo is valid only for blocked terminal source");
    } else if (event.terminalSource !== void 0 || event.terminalResumeTo !== void 0) {
      throw invalid2("Non-terminal transition cannot contain terminal source metadata");
    }
    previous = event.to;
  }
  if (state.status === "new") {
    if (events.length || state.revision !== 0) throw invalid2("State new must have no transition history");
  } else if (previous !== state.status) {
    throw invalid2(`State latest history status ${String(previous)} does not match current ${state.status}`);
  }
  const confirmedByHistory = events.some((event) => event.from === "awaiting_mode_confirmation" && (event.to === "executing" || event.to === "discovering"));
  if (state.modeConfirmed !== ((state.historySummary?.modeConfirmed ?? false) || confirmedByHistory)) throw invalid2("State V2 modeConfirmed contradicts history");
  if (state.status === "blocked") {
    if (!state.resumeTo || !isOperationalResumeTarget(state.resumeTo) || !state.remainingActions.length) throw invalid2("Blocked V2 state has invalid resume metadata");
    if (state.pendingGate && state.resumeTo !== "awaiting_approval") throw invalid2("Blocked pendingGate requires resumeTo awaiting_approval");
  }
  if (state.status === "awaiting_approval") {
    if (!state.pendingGate) throw invalid2("awaiting_approval requires pendingGate");
    const latest = events.at(-1);
    if (latest && latest.gateContext !== state.pendingGate) throw invalid2("pendingGate contradicts latest gate context");
    if (latest && state.pendingGate === "pre_build" && latest.from !== "planning" && latest.from !== "blocked") throw invalid2("pre_build pendingGate requires planning or resumed source");
    if (state.pendingGate === "critical_completion" && (latest && latest.from !== "verifying" && latest.from !== "blocked" || state.mode !== "critical")) throw invalid2("critical_completion pendingGate requires Critical verifying or resumed source");
  }
  if (state.pendingGate) {
    if (activeGate !== state.pendingGate || activeGateDigest !== state.contractDigest) throw invalid2("Persisted gate context does not match active gate anchor");
  } else if (activeGate !== void 0) {
    throw invalid2("Compacted active gate anchor survives outside a pending gate");
  }
  if (state.status === "cancelled" || state.status === "failed") deriveMacroPhase(state);
}
var STRUCTURAL_GUARDS = /* @__PURE__ */ new Set(["task_initialized", "resume_metadata_valid", "terminal_source_recorded", "gate_context_valid"]);
var TRUSTED_EVALUATOR_REQUIRED = /* @__PURE__ */ new Set(["intake_complete", "verification_complete", "handoff_intent_resolved", "handoff_reconciled", "critical_completion_approved"]);
var WORKFLOW_EVENT_TYPES = /* @__PURE__ */ new Set([
  "task.created",
  "state.migrated",
  "task.blocked",
  "task.resumed",
  "gate.recorded",
  "scope.approved",
  "artifact.recorded",
  "issue.recorded",
  "correction.recorded",
  "handoff.attempted",
  "handoff.result",
  "context.updated",
  "intake.question_recorded",
  "intake.answer_recorded",
  "intake.checkpoint",
  "advance.rejected",
  "intake.reopened"
]);
var HISTORY_REFERENCE_KINDS = /* @__PURE__ */ new Set([
  "task",
  "mode-evidence",
  "migration-source",
  "migration-target",
  "artifact",
  "worktree",
  "context-capsule",
  "context",
  "issue",
  "correction",
  "gate",
  "scope",
  "handoff",
  "evidence",
  "receipt",
  "command",
  "criterion",
  "decision",
  "policy",
  "config",
  "git",
  "symbol"
]);
function isTransitionEvent(event) {
  return event.type === "state.transition";
}
function normalizeEventAt(value) {
  const source = value ?? (/* @__PURE__ */ new Date()).toISOString();
  if (!isValidRfc3339(source)) throw new Error("History event at must be a valid RFC 3339 calendar timestamp.");
  const date = new Date(source);
  if (!Number.isFinite(date.valueOf())) throw new Error("History event at must be a valid RFC 3339 calendar timestamp.");
  return date.toISOString();
}
function migrationEventAt(sequence) {
  return new Date(sequence - 1).toISOString();
}
function nextHistorySequence(state) {
  return (state.history.at(-1)?.sequence ?? state.historySummary?.lastSequence ?? 0) + 1;
}
function normalizeHistoryEnvelope(state) {
  if (state.history.every((event) => event.sequence !== void 0 && event.at !== void 0)) return state;
  if (state.historySummary || state.history.some((event) => event.sequence !== void 0 || event.at !== void 0 || !isTransitionEvent(event))) {
    throw invalid2("State V2 history mixes legacy and structured event envelopes");
  }
  return {
    ...state,
    history: state.history.map((event, index) => ({ ...event, sequence: index + 1, at: migrationEventAt(index + 1) }))
  };
}
function withCompactedHistory(state, inputHistory) {
  const normalized = normalizeHistoryEnvelope({ ...state, history: inputHistory });
  if (normalized.history.length <= HISTORY_LIMIT) return normalized;
  const removed = normalized.history.slice(0, normalized.history.length - HISTORY_LIMIT);
  const history = normalized.history.slice(-HISTORY_LIMIT);
  const previous = normalized.historySummary;
  const typeCounts = { ...previous?.typeCounts ?? {} };
  for (const event of removed) typeCounts[event.type] = (typeCounts[event.type] ?? 0) + 1;
  const removedTransitions = removed.filter(isTransitionEvent);
  const lastRemovedTransition = removedTransitions.at(-1);
  const lastTransition = lastRemovedTransition ? { sequence: lastRemovedTransition.sequence, revision: lastRemovedTransition.revision, to: lastRemovedTransition.to } : previous?.lastTransition;
  const modeConfirmed = (previous?.modeConfirmed ?? false) || removedTransitions.some(
    (event) => event.from === "awaiting_mode_confirmation" && (event.to === "executing" || event.to === "discovering")
  );
  const activeGate = foldCompactedGate(previous?.activeGate, removedTransitions);
  return {
    ...normalized,
    history,
    historySummary: {
      removedCount: (previous?.removedCount ?? 0) + removed.length,
      firstSequence: previous?.firstSequence ?? removed[0].sequence,
      lastSequence: removed.at(-1)?.sequence ?? previous?.lastSequence ?? 0,
      firstAt: previous?.firstAt ?? removed[0].at,
      lastAt: removed.at(-1)?.at ?? previous?.lastAt ?? "",
      typeCounts,
      modeConfirmed,
      ...lastTransition ? { lastTransition } : {},
      ...activeGate ? { activeGate } : {}
    }
  };
}
function foldCompactedGate(initial, events) {
  let active = initial ? copy2(initial) : void 0;
  for (const event of events) {
    if (event.to === "awaiting_approval" && (event.from === "planning" || event.from === "verifying")) {
      const gateContext = event.from === "planning" ? "pre_build" : "critical_completion";
      const verificationReceipt = event.guardEvidence?.find((evidence) => evidence.guard === "verification_complete")?.evaluatorReceipt;
      active = {
        gateContext,
        contractDigest: event.contractDigest ?? "",
        entrySequence: event.sequence,
        entryRevision: event.revision,
        entryFrom: event.from,
        sourceFingerprint: event.sourceFingerprint,
        ...verificationReceipt ? { verificationReceipt: copy2(verificationReceipt) } : {}
      };
      continue;
    }
    if (event.from === "awaiting_approval" && event.to !== "blocked") active = void 0;
    else if (event.from === "blocked" && event.gateContext && event.to !== "awaiting_approval" && event.to !== "blocked") active = void 0;
  }
  return active;
}
function validateHistoryEnvelope(state) {
  const structured = state.history.some((event) => event.sequence !== void 0 || event.at !== void 0 || !isTransitionEvent(event));
  if (!structured && !state.historySummary) return;
  if (state.history.length > HISTORY_LIMIT) throw invalid2(`State V2 history exceeds ${HISTORY_LIMIT} events`);
  let expected = (state.historySummary?.lastSequence ?? 0) + 1;
  for (const [index, event] of state.history.entries()) {
    if (event.sequence !== expected) throw invalid2(`State V2 history sequence is non-monotonic at event ${index}`);
    assertRfc3339(event.at, `State V2 event ${index} at`);
    if (!isTransitionEvent(event)) validateHistoryReferences(event.refs, `State V2 event ${index}`);
    expected += 1;
  }
  const summary = state.historySummary;
  if (!summary) {
    if (state.history[0]?.sequence !== 1) throw invalid2("State V2 history without summary must start at sequence 1");
    return;
  }
  if (summary.removedCount < 1 || summary.firstSequence !== 1 || summary.lastSequence !== summary.removedCount) throw invalid2("State V2 historySummary sequence range is inconsistent");
  assertRfc3339(summary.firstAt, "State V2 historySummary firstAt");
  assertRfc3339(summary.lastAt, "State V2 historySummary lastAt");
  const count = Object.values(summary.typeCounts).reduce((sum, value) => sum + value, 0);
  if (count !== summary.removedCount || Object.entries(summary.typeCounts).some(([type, value]) => !isHistoryType(type) || !Number.isInteger(value) || value < 1)) {
    throw invalid2("State V2 historySummary type counters are inconsistent");
  }
  const transitionCount = summary.typeCounts["state.transition"] ?? 0;
  if (transitionCount > 0) {
    if (!summary.lastTransition || summary.lastTransition.revision !== transitionCount || summary.lastTransition.sequence > summary.lastSequence) {
      throw invalid2("State V2 historySummary transition anchor is inconsistent");
    }
  } else if (summary.lastTransition !== void 0 || summary.modeConfirmed) {
    throw invalid2("State V2 historySummary has transition metadata without transitions");
  }
  if (summary.activeGate) validateCompactedGateAnchor(summary.activeGate, transitionCount, summary.lastSequence);
}
function validateCompactedGateAnchor(anchor, transitionCount, lastSequence) {
  const expectedGate = anchor.entryFrom === "planning" ? "pre_build" : "critical_completion";
  if (anchor.gateContext !== expectedGate || !compactRef(anchor.contractDigest) || !compactRef(anchor.sourceFingerprint) || anchor.entrySequence > lastSequence || anchor.entryRevision > transitionCount) {
    throw invalid2("State V2 compacted gate anchor is malformed");
  }
  if (anchor.gateContext === "pre_build") {
    if (anchor.verificationReceipt !== void 0) throw invalid2("Pre-build compacted gate cannot carry verification receipt");
    return;
  }
  if (!anchor.verificationReceipt) throw invalid2("Critical compacted gate lacks matching verification receipt");
  try {
    validateCompactedVerificationReceipt(anchor);
  } catch (error) {
    throw invalid2(error instanceof Error ? error.message : "Critical compacted gate receipt is invalid");
  }
}
function validateCompactedVerificationReceipt(anchor) {
  const receipt = anchor.verificationReceipt;
  if (!receipt) throw new Error("Critical compacted gate lacks verification receipt.");
  const reconstructed = {
    schemaVersion: 1,
    guard: "verification_complete",
    stateRevision: anchor.entryRevision - 1,
    stateFingerprint: anchor.sourceFingerprint,
    observedFingerprint: receipt.receiptDigest,
    evidenceRefs: [...receipt.evidenceRefs],
    provenance: "deterministic-check",
    result: "passed",
    evaluatorReceipt: receipt
  };
  validateEvaluatorReceipt(reconstructed, anchor.sourceFingerprint, anchor.entryRevision - 1);
}
function isHistoryType(value) {
  return value === "state.transition" || WORKFLOW_EVENT_TYPES.has(value);
}
function assertRfc3339(value, label) {
  if (typeof value !== "string" || !isValidRfc3339(value)) throw invalid2(`${label} must be a valid RFC 3339 calendar timestamp`);
}
function isValidRfc3339(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[9] === void 0 ? 0 : Number(match[9]);
  const offsetMinute = match[10] === void 0 ? 0 : Number(match[10]);
  if (year < 1 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59 || offsetHour > 23 || offsetMinute > 59) return false;
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= days[month - 1];
}
function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
function validateHistoryReferences(refs, label) {
  if (!Array.isArray(refs) || refs.length < 1 || refs.length > HISTORY_REFERENCE_LIMIT) throw invalid2(`${label} requires 1..${HISTORY_REFERENCE_LIMIT} structured references`);
  let totalChars = 0;
  for (const ref of refs) {
    if (!isRecord6(ref) || !HISTORY_REFERENCE_KINDS.has(ref.kind) || !historyReferenceToken(ref.kind, 32) || !historyReferenceToken(ref.ref, 512) || ref.fingerprint !== void 0 && !historyReferenceToken(ref.fingerprint, 512)) {
      throw invalid2(`${label} contains malformed or non-compact references`);
    }
    totalChars += ref.kind.length + ref.ref.length + (typeof ref.fingerprint === "string" ? ref.fingerprint.length : 0);
  }
  if (totalChars > HISTORY_REFERENCE_TOTAL_CHARS) throw invalid2(`${label} references exceed compact size bound`);
}
function historyReferenceToken(value, maxLength) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength && /^[A-Za-z0-9][A-Za-z0-9._:/#@+~=-]*$/.test(value);
}
function defaultContextCapsule(configSnapshot, policySnapshot) {
  return {
    schemaVersion: 1,
    entries: [],
    fingerprints: [
      { id: "config", kind: "config", value: `sha256:${digest(configSnapshot)}`, provenanceRef: "state:configSnapshot" },
      { id: "policy", kind: "policy", value: `sha256:${digest(policySnapshot)}`, provenanceRef: "state:policySnapshot" }
    ]
  };
}
function validateContextCapsule(capsule) {
  if (capsule.schemaVersion !== 1 || !Array.isArray(capsule.entries) || !Array.isArray(capsule.fingerprints)) throw invalid2("Context Capsule is malformed");
  const ids = /* @__PURE__ */ new Set();
  for (const fingerprint of capsule.fingerprints) {
    if (!compactRef(fingerprint.id) || ids.has(fingerprint.id) || !["git", "config", "policy", "artifact", "worktree"].includes(fingerprint.kind) || !compactRef(fingerprint.value) || !compactRef(fingerprint.provenanceRef)) throw invalid2("Context Capsule fingerprint is malformed");
    ids.add(fingerprint.id);
  }
  for (const entry of capsule.entries) {
    if (!["objective", "approved_scope", "risk", "relevant_code", "constraints", "acceptance", "decision", "evidence"].includes(entry.section) || !compactRef(entry.ownerRef) || !compactRef(entry.provenanceRef) || !Array.isArray(entry.fingerprintRefs) || entry.fingerprintRefs.length < 1 || new Set(entry.fingerprintRefs).size !== entry.fingerprintRefs.length || entry.fingerprintRefs.some((id) => !ids.has(id))) throw invalid2("Context Capsule entry is malformed or references unknown fingerprints");
  }
}
function compactRef(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 1024 && !/[\r\n\0]/.test(value);
}
function formatSchemaError(value) {
  if (!isRecord6(value)) return "unknown schema error";
  return `${String(value.instancePath || "/")} ${String(value.message ?? "invalid")}`;
}
function invalid2(message) {
  return new StateMigrationError("state_invalid", `${message}; state was not modified.`);
}
function ambiguous(message) {
  return new StateMigrationError("state_migration_ambiguous", `${message}. Resolve ambiguity with provenance; state was not modified.`);
}
function unsupported(message) {
  return new StateMigrationError("state_version_unsupported", `${message}; state was not modified.`);
}
function isLegacyTransition(value) {
  return isRecord6(value) && isV1Status(value.from) && isV1Status(value.to);
}
function isV1Status(value) {
  return typeof value === "string" && V1_STATUSES.includes(value);
}
function isTaskMode(value) {
  return value === "quick" || value === "standard" || value === "critical";
}
function nonEmpty(value) {
  return typeof value === "string" && value.length > 0;
}
function isRecord6(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function copy2(value) {
  if (Array.isArray(value)) return value.map(copy2);
  if (isRecord6(value)) return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, copy2(nested)]));
  return value;
}
function stateFingerprintAtRevision(state, revision) {
  const history = state.history.map((event) => ({
    ...event,
    ...isTransitionEvent(event) && event.guardEvidence ? {
      guardEvidence: event.guardEvidence.map(({ stateFingerprint: _stateFingerprint, ...evidence }) => evidence)
    } : {},
    ...isTransitionEvent(event) && event.gateDecision ? {
      gateDecision: (({ stateFingerprint: _stateFingerprint, ...decision }) => decision)(event.gateDecision)
    } : {}
  }));
  const projection = {
    schemaVersion: state.schemaVersion,
    taskId: state.taskId,
    mode: state.mode,
    modeEvidenceRef: state.modeEvidenceRef,
    configSnapshot: state.configSnapshot,
    policySnapshot: state.policySnapshot,
    verificationRequirements: state.verificationRequirements,
    routingSnapshot: state.routingSnapshot,
    routingPolicyVersion: state.routingPolicyVersion,
    activeArtifact: state.activeArtifact,
    activeWorktree: state.activeWorktree,
    contextCapsule: state.contextCapsule,
    intake: state.intake,
    benchmarkEnabled: state.benchmarkEnabled,
    historySummary: state.historySummary,
    revision,
    history
  };
  return createHash("sha256").update(stable(projection)).digest("hex");
}
function stable(value) {
  return JSON.stringify(canonicalize(value));
}
function compareSnapshot(state, current) {
  const reasons = [];
  if (stable(state.configSnapshot) !== stable(current.config)) reasons.push("Effective configuration changed.");
  if (stable(state.policySnapshot) !== stable(current.policy)) reasons.push("Effective policy changed.");
  if (state.routingSnapshot && current.routingSnapshot && stableRoutingSnapshot(state.routingSnapshot) !== stableRoutingSnapshot(current.routingSnapshot)) reasons.push("Routing snapshot changed.");
  return { changed: reasons.length > 0, reasons };
}
function stableRoutingSnapshot(snapshot) {
  const { capturedAt: _capturedAt, ...behavior } = snapshot;
  return stable(behavior);
}
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isRecord6(value)) {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, nested]) => [key, canonicalize(nested)]));
  }
  return value;
}

// src/state-store.ts
var STATE_FILENAME = "state.yaml";
var STATE_V1_BACKUP_FILENAME = "state.v1.yaml";
var StateStoreError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "StateStoreError";
  }
  code;
};
var DEFAULT_FILE_SYSTEM = {
  readFile: async (path) => {
    const handle = await nodeFs.open(path, constants2.O_RDONLY | (constants2.O_NOFOLLOW ?? 0));
    try {
      const metadata = await handle.stat();
      if (!metadata.isFile()) throw Object.assign(new Error("State path is not a regular file."), { code: "EINVAL" });
      return await handle.readFile();
    } finally {
      await handle.close();
    }
  },
  mkdir: (path, options) => nodeFs.mkdir(path, options),
  writeFile: (path, data, options) => nodeFs.writeFile(path, data, options),
  rename: (from, to) => nodeFs.rename(from, to),
  link: (from, to) => nodeFs.link(from, to),
  lstat: (path) => nodeFs.lstat(path),
  realpath: (path) => nodeFs.realpath(path),
  unlink: (path) => nodeFs.unlink(path)
};
var TaskStateStore = class {
  workspaceRoot;
  tasksRoot;
  #fileSystem;
  #temporaryId;
  constructor(workspaceRoot, options = {}) {
    if (typeof workspaceRoot !== "string" || !workspaceRoot || workspaceRoot.includes("\0")) {
      throw new StateStoreError("state_path_invalid", "Workspace root is invalid.");
    }
    try {
      this.workspaceRoot = realpathSync2(resolve2(workspaceRoot));
      if (!lstatSync2(this.workspaceRoot).isDirectory()) throw new Error("Workspace root is not a directory.");
    } catch {
      throw new StateStoreError("state_path_invalid", "Workspace root must be an existing accessible directory.");
    }
    this.tasksRoot = resolve2(this.workspaceRoot, ".codex", "tasks");
    this.#fileSystem = { ...DEFAULT_FILE_SYSTEM, ...options.fileSystem };
    this.#temporaryId = options.temporaryId ?? randomUUID3;
  }
  paths(taskId) {
    assertSafeTaskId2(taskId);
    const directory = resolve2(this.tasksRoot, taskId);
    const fromTasksRoot = relative(this.tasksRoot, directory);
    if (!fromTasksRoot || fromTasksRoot.startsWith(`..${sep}`) || fromTasksRoot === ".." || isAbsolute(fromTasksRoot)) {
      throw new StateStoreError("state_path_invalid", "Task ID resolves outside task state root.");
    }
    return {
      directory,
      statePath: join4(directory, STATE_FILENAME),
      backupPath: join4(directory, STATE_V1_BACKUP_FILENAME)
    };
  }
  async load(taskId, migrationOptions = {}) {
    const paths = this.paths(taskId);
    await this.#assertExistingTaskDirectory(paths);
    await this.#assertRegularFile(paths.statePath, false);
    const source = await this.#readState(paths.statePath);
    const parsed = parseStateYaml(source);
    const result = migrateStateToV2(parsed, migrationOptions);
    assertMatchingTaskId(taskId, result.state);
    return result;
  }
  async save(taskId, state) {
    const paths = this.paths(taskId);
    const validated = validateSaveState(state);
    assertMatchingTaskId(taskId, validated);
    const serialized = serializeValidatedState(validated);
    await this.#ensureTaskDirectory(paths);
    await this.#assertRegularFile(paths.statePath, true);
    await this.#atomicWrite(paths, paths.statePath, serialized);
  }
  async migrateForResume(taskId, migrationOptions = {}) {
    const paths = this.paths(taskId);
    await this.#assertExistingTaskDirectory(paths);
    await this.#assertRegularFile(paths.statePath, false);
    const source = await this.#readState(paths.statePath);
    const parsed = parseStateYaml(source);
    const result = migrateStateToV2(parsed, migrationOptions);
    assertMatchingTaskId(taskId, result.state);
    if (!result.migrationRequired) return { ...result, persisted: false };
    const serialized = serializeValidatedState(result.state);
    await this.#preserveV1Backup(paths, source);
    await this.#atomicWrite(paths, paths.statePath, serialized);
    return { ...result, persisted: true, backupPath: paths.backupPath };
  }
  async #readState(path) {
    try {
      return await this.#fileSystem.readFile(path);
    } catch (error) {
      if (hasCode2(error, "ENOENT")) throw new StateStoreError("state_not_found", "Task state file does not exist.");
      throw new StateStoreError("state_read_failed", "Task state file could not be read.");
    }
  }
  async #preserveV1Backup(paths, source) {
    await this.#assertRegularFile(paths.backupPath, true);
    const temporaryPath = createTemporaryPath(paths.directory, STATE_V1_BACKUP_FILENAME, this.#temporaryId());
    let ownsTemporary = true;
    let stage = "write";
    try {
      await this.#fileSystem.writeFile(temporaryPath, source, { flag: "wx", mode: 384 });
      stage = "link";
      await this.#fileSystem.link(temporaryPath, paths.backupPath);
    } catch (error) {
      if (stage === "write" && hasCode2(error, "EEXIST")) ownsTemporary = false;
      if (stage === "link" && hasCode2(error, "EEXIST")) {
        await this.#assertRegularFile(paths.backupPath, false);
        const existing = await this.#readBackup(paths.backupPath);
        if (!existing.equals(source)) {
          throw new StateStoreError("state_backup_conflict", "Existing V1 backup differs from current V1 state.");
        }
        return;
      }
      throw new StateStoreError("state_write_failed", "V1 backup could not be published safely.");
    } finally {
      if (ownsTemporary) await this.#unlinkBestEffort(temporaryPath);
    }
  }
  async #atomicWrite(paths, destination, data) {
    const temporaryPath = createTemporaryPath(paths.directory, STATE_FILENAME, this.#temporaryId());
    let ownsTemporary = true;
    let stage = "write";
    try {
      await this.#fileSystem.writeFile(temporaryPath, data, { flag: "wx", mode: 384 });
      stage = "rename";
      await this.#fileSystem.rename(temporaryPath, destination);
      ownsTemporary = false;
    } catch (error) {
      if (stage === "write" && hasCode2(error, "EEXIST")) ownsTemporary = false;
      throw new StateStoreError("state_write_failed", "Task state could not be written atomically.");
    } finally {
      if (ownsTemporary) await this.#unlinkBestEffort(temporaryPath);
    }
  }
  async #ensureTaskDirectory(paths) {
    for (const path of [join4(this.workspaceRoot, ".codex"), this.tasksRoot, paths.directory]) {
      try {
        await this.#fileSystem.mkdir(path, { mode: 448 });
      } catch (error) {
        if (!hasCode2(error, "EEXIST")) {
          throw new StateStoreError("state_write_failed", "Task state directory could not be created.");
        }
      }
      await this.#assertDirectory(path, false);
    }
    await this.#assertCanonicalContainment(paths.directory);
  }
  async #assertExistingTaskDirectory(paths) {
    for (const path of [join4(this.workspaceRoot, ".codex"), this.tasksRoot, paths.directory]) {
      await this.#assertDirectory(path, false);
    }
    await this.#assertCanonicalContainment(paths.directory);
  }
  async #assertDirectory(path, optional) {
    try {
      const metadata = await this.#fileSystem.lstat(path);
      if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
        throw new StateStoreError("state_path_invalid", "Task state path contains a symlink or non-directory component.");
      }
    } catch (error) {
      if (error instanceof StateStoreError) throw error;
      if (optional && hasCode2(error, "ENOENT")) return;
      if (hasCode2(error, "ENOENT")) throw new StateStoreError("state_not_found", "Task state directory does not exist.");
      throw new StateStoreError("state_read_failed", "Task state directory could not be inspected.");
    }
  }
  async #assertRegularFile(path, optional) {
    try {
      const metadata = await this.#fileSystem.lstat(path);
      if (metadata.isSymbolicLink() || !metadata.isFile()) {
        throw new StateStoreError("state_path_invalid", "Task state path is a symlink or non-regular file.");
      }
    } catch (error) {
      if (error instanceof StateStoreError) throw error;
      if (optional && hasCode2(error, "ENOENT")) return;
      if (hasCode2(error, "ENOENT")) throw new StateStoreError("state_not_found", "Task state file does not exist.");
      throw new StateStoreError("state_read_failed", "Task state path could not be inspected.");
    }
  }
  async #assertCanonicalContainment(taskDirectory) {
    try {
      const [canonicalTasksRoot, canonicalTaskDirectory] = await Promise.all([
        this.#fileSystem.realpath(this.tasksRoot),
        this.#fileSystem.realpath(taskDirectory)
      ]);
      const fromTasksRoot = relative(canonicalTasksRoot, canonicalTaskDirectory);
      if (!fromTasksRoot || fromTasksRoot === ".." || fromTasksRoot.startsWith(`..${sep}`) || isAbsolute(fromTasksRoot)) {
        throw new StateStoreError("state_path_invalid", "Task state directory resolves outside canonical task root.");
      }
    } catch (error) {
      if (error instanceof StateStoreError) throw error;
      throw new StateStoreError("state_path_invalid", "Task state directory could not be resolved safely.");
    }
  }
  async #readBackup(path) {
    try {
      return await this.#fileSystem.readFile(path);
    } catch {
      throw new StateStoreError("state_read_failed", "Existing V1 backup could not be read.");
    }
  }
  async #unlinkBestEffort(path) {
    try {
      await this.#fileSystem.unlink(path);
    } catch {
    }
  }
};
function createTaskStateStore(workspaceRoot, options = {}) {
  return new TaskStateStore(workspaceRoot, options);
}
function parseStateYaml(source) {
  try {
    return (0, import_yaml3.parse)(source.toString("utf8"));
  } catch {
    throw new StateStoreError("state_yaml_invalid", "Task state file is not valid YAML.");
  }
}
function validateSaveState(value) {
  let result;
  try {
    result = migrateStateToV2(value);
  } catch (error) {
    if (error instanceof StateMigrationError) throw error;
    throw new StateStoreError("state_save_requires_v2", "Only valid V2 task state can be saved.");
  }
  if (result.migrationRequired) {
    throw new StateStoreError("state_save_requires_v2", "V1 task state requires explicit resume migration.");
  }
  return result.state;
}
function serializeValidatedState(state) {
  const serialized = (0, import_yaml3.stringify)(state);
  const reparsed = parseStateYaml(Buffer.from(serialized, "utf8"));
  const validated = migrateStateToV2(reparsed);
  if (validated.migrationRequired) {
    throw new StateStoreError("state_save_requires_v2", "Serialized task state is not V2.");
  }
  return serialized;
}
function assertMatchingTaskId(expected, state) {
  if (state.taskId !== expected) {
    throw new StateStoreError("state_task_mismatch", "Task state taskId does not match requested task ID.");
  }
}
function assertSafeTaskId2(taskId) {
  if (typeof taskId !== "string" || !taskId || taskId === "." || taskId === ".." || taskId.includes("/") || taskId.includes("\\") || taskId.includes("\0")) throw new StateStoreError("state_path_invalid", "Task ID must be one non-traversing path segment.");
}
function createTemporaryPath(directory, basename2, temporaryId) {
  if (!temporaryId || temporaryId.includes("/") || temporaryId.includes("\\") || temporaryId.includes("\0")) {
    throw new StateStoreError("state_path_invalid", "Temporary state identifier must be one non-traversing path segment.");
  }
  return join4(directory, `.${basename2}.${temporaryId}.tmp`);
}
function hasCode2(error, code) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

// src/policy.ts
var PolicyError = class extends Error {
  constructor(message, path, source) {
    super(message);
    this.path = path;
    this.source = source;
  }
  path;
  source;
  exitCode = EXIT_CODES.POLICY_CONTRADICTION;
};
function readPath(value, path) {
  return path.split(".").reduce((current, segment) => {
    if (typeof current !== "object" || current === null || Array.isArray(current)) return void 0;
    return current[segment];
  }, value);
}
function applyPolicy(config, policy) {
  for (const [path, required2] of Object.entries(policy.requirements)) {
    if (readPath(config.value, path) !== required2) {
      throw new PolicyError(
        "Policy requires " + path + " to be " + JSON.stringify(required2) + ".",
        path,
        config.provenance[path]
      );
    }
  }
  for (const [path, forbidden] of Object.entries(policy.prohibitions)) {
    if (readPath(config.value, path) === forbidden) {
      throw new PolicyError(
        "Policy prohibits " + path + " from being " + JSON.stringify(forbidden) + ".",
        path,
        config.provenance[path]
      );
    }
  }
  return config;
}

// src/metrics.ts
import { createHash as createHash2, randomUUID as randomUUID4 } from "node:crypto";
var LIFECYCLE_METRICS = Object.freeze([
  "model_calls",
  "delegations",
  "input_tokens",
  "output_tokens",
  "token_proxy_context_bytes",
  "context_bytes",
  "latency_ms",
  "capsule_reuses",
  "capsule_invalidations",
  "validation_runs",
  "correction_cycles",
  "review_lanes",
  "human_confirmations",
  "intake_questions",
  "intake_questions_avoided",
  "intake_recommendations_accepted",
  "intake_recommendations_modified",
  "intake_zero_question_paths",
  "intake_late_reopenings",
  "mode_changes",
  "routing_decisions",
  "gates",
  "blocks",
  "transition_errors",
  "resume_to_first_action_ms",
  "unused_phase_outputs",
  "duplicated_fields",
  "silent_resume_divergences",
  "false_success_detections"
]);
var EVENT_KEYS = /* @__PURE__ */ new Set([
  "runId",
  "mode",
  "phase",
  "metric",
  "value",
  "measurement",
  "source",
  "sequence",
  "occurredAtEpochMs",
  "model",
  "effort",
  "quotaPressure"
]);
var TOKEN_METRICS = /* @__PURE__ */ new Set(["input_tokens", "output_tokens"]);
function createLifecycleMetricEvent(input) {
  const unknown = Object.keys(input).filter((key) => !EVENT_KEYS.has(key));
  if (unknown.length) throw new Error(`Unknown metric event fields: ${unknown.join(", ")}.`);
  if (!isUuid(input.runId) || !isTaskMode2(input.mode) || !MACRO_PHASES.includes(input.phase)) {
    throw new Error("Metric event identity, mode, or phase is invalid.");
  }
  if (!LIFECYCLE_METRICS.includes(input.metric) || !nonNegativeFinite(input.value)) {
    throw new Error("Metric event metric or value is invalid.");
  }
  if (input.sequence !== void 0 && (!Number.isInteger(input.sequence) || input.sequence < 0)) throw new Error("Metric sequence is invalid.");
  if (input.occurredAtEpochMs !== void 0 && (!Number.isInteger(input.occurredAtEpochMs) || input.occurredAtEpochMs < 0)) throw new Error("Metric timestamp is invalid.");
  validateDimensions(input);
  validateMeasurementSource(input.metric, input.measurement, input.source);
  return {
    schemaVersion: 1,
    runId: input.runId,
    mode: input.mode,
    phase: input.phase,
    metric: input.metric,
    value: input.value,
    measurement: input.measurement,
    source: input.source,
    ...input.sequence !== void 0 ? { sequence: input.sequence } : {},
    ...input.occurredAtEpochMs !== void 0 ? { occurredAtEpochMs: input.occurredAtEpochMs } : {},
    ...input.model !== void 0 ? { model: input.model } : {},
    ...input.effort !== void 0 ? { effort: input.effort } : {},
    ...input.quotaPressure !== void 0 ? { quotaPressure: input.quotaPressure } : {}
  };
}
function createMetricRunId() {
  return randomUUID4();
}
function tryCreateLifecycleMetricEvent(input) {
  try {
    return { accepted: true, event: createLifecycleMetricEvent(input) };
  } catch {
    return { accepted: false, errorCode: "metric_rejected" };
  }
}
function summarizeLifecycleTrace(input) {
  if (!nonEmpty2(input.runId) || !isTaskMode2(input.mode) || !["contract_fixture", "runtime"].includes(input.source)) {
    throw new Error("Trace identity, mode, or source is invalid.");
  }
  if (input.source === "runtime" && !isUuid(input.runId)) throw new Error("Runtime trace requires opaque UUID runId.");
  if (!Array.isArray(input.statuses) || input.statuses.length < 2 || input.statuses[0] !== "new") {
    throw new Error("Lifecycle trace must start at new and contain a transition.");
  }
  const statuses = [...input.statuses];
  for (const [index, status] of statuses.entries()) {
    if (!isTaskStatus(status)) throw new Error(`Unknown lifecycle status ${String(status)}.`);
    if (index === 0) continue;
    const from = statuses[index - 1];
    const contract = STATE_MACHINE[from].transitions[status];
    if (!contract) throw new Error(`Lifecycle trace edge ${from} -> ${status} is illegal.`);
    if (!contract.modes.includes(input.mode)) throw new Error(`Lifecycle trace edge ${from} -> ${status} is illegal for mode ${input.mode}.`);
  }
  const terminalStatus = statuses.at(-1);
  if (!STATE_MACHINE[terminalStatus].stable && !STATE_MACHINE[terminalStatus].terminal) {
    throw new Error(`Lifecycle trace must end at stable or terminal status; received ${terminalStatus}.`);
  }
  const phases = unique(statuses.map((status, index) => tracePhase(status, statuses, index)));
  const edges = statuses.slice(1).map((to, index) => ({ from: statuses[index], to }));
  const falseSuccessDetections = input.falseSuccessDetections;
  if (!Number.isInteger(falseSuccessDetections) || falseSuccessDetections < 0) throw new Error("falseSuccessDetections must be a non-negative integer.");
  if (!["contract_tests", "operator_audit"].includes(input.falseSuccessDetectionSource)) throw new Error("falseSuccessDetectionSource is required.");
  const expectedAuditSource = input.source === "contract_fixture" ? "contract_tests" : "operator_audit";
  if (input.falseSuccessDetectionSource !== expectedAuditSource) throw new Error(`Trace source ${input.source} requires false-success source ${expectedAuditSource}.`);
  const tokenUsage = input.tokenUsage ? validateTokenUsage(input.tokenUsage) : { availability: "unavailable" };
  const latency = input.latency === void 0 ? { availability: "unavailable" } : validateLatency(input.latency);
  return {
    schemaVersion: 1,
    sampleIdHash: sha256(input.runId),
    mode: input.mode,
    source: input.source,
    statuses,
    phases,
    transitions: edges.length,
    gates: edges.filter(({ from, to }) => to === "awaiting_approval" && (from === "planning" || from === "verifying")).length,
    blocks: edges.filter(({ to }) => to === "blocked").length,
    resumes: edges.filter(({ from, to }) => from === "blocked" && to !== "cancelled" && to !== "failed").length,
    validationRuns: edges.filter(({ to }) => to === "validating").length,
    reviewRuns: edges.filter(({ to }) => to === "reviewing").length,
    buildResolutionCycles: edges.filter(({ to }) => to === "resolving_build").length,
    assureResolutionCycles: edges.filter(({ to }) => to === "resolving_assure").length,
    terminalStatus,
    falseSuccessDetections,
    falseSuccessDetectionSource: input.falseSuccessDetectionSource,
    tokenUsage,
    latency
  };
}
function buildBaselineReport(input) {
  const samples = input.traces.map(summarizeLifecycleTrace);
  const report = {
    schemaVersion: 1,
    baselineId: input.baselineId,
    capturedAt: input.capturedAt,
    contractVersion: input.contractVersion,
    source: input.source,
    limitations: [...input.limitations],
    samples
  };
  const validation = validateBaselineReport(report);
  if (!validation.valid) throw new Error(`Invalid baseline report: ${validation.errors.join("; ")}.`);
  return report;
}
function validateBaselineReport(value) {
  const errors = [];
  if (!isRecord7(value)) return { valid: false, errors: ["report must be an object"] };
  exactKeys(value, ["schemaVersion", "baselineId", "capturedAt", "contractVersion", "source", "limitations", "samples"], "report", errors);
  if (value.schemaVersion !== 1) errors.push("schemaVersion must equal 1");
  if (!nonEmpty2(value.baselineId) || !isIsoDate(value.capturedAt) || value.contractVersion !== "P0" || value.source !== "contract_fixture") errors.push("report identity is invalid");
  const limitations = value.limitations;
  const allowedLimitations = ["contract_fixture_not_runtime", "token_telemetry_unavailable", "latency_telemetry_unavailable"];
  if (!Array.isArray(limitations) || JSON.stringify(limitations) !== JSON.stringify(allowedLimitations)) errors.push("limitations are invalid");
  if (!Array.isArray(value.samples) || value.samples.length !== 3) errors.push("baseline requires exactly three samples");
  else {
    const modes = [];
    for (const [index, sample] of value.samples.entries()) validateSummary(sample, index, modes, errors);
    if (modes.join(",") !== "quick,standard,critical") errors.push("samples must cover quick, standard, critical in order");
  }
  return { valid: errors.length === 0, errors };
}
function validateSummary(value, index, modes, errors) {
  if (!isRecord7(value)) {
    errors.push(`sample ${index} must be an object`);
    return;
  }
  exactKeys(value, [
    "schemaVersion",
    "sampleIdHash",
    "mode",
    "source",
    "statuses",
    "phases",
    "transitions",
    "gates",
    "blocks",
    "resumes",
    "validationRuns",
    "reviewRuns",
    "buildResolutionCycles",
    "assureResolutionCycles",
    "terminalStatus",
    "falseSuccessDetections",
    "falseSuccessDetectionSource",
    "tokenUsage",
    "latency"
  ], `sample ${index}`, errors);
  if (value.schemaVersion !== 1 || !isTaskMode2(value.mode) || value.source !== "contract_fixture" || !/^[a-f0-9]{64}$/.test(String(value.sampleIdHash))) {
    errors.push(`sample ${index} identity is invalid`);
    return;
  }
  modes.push(value.mode);
  if (!Number.isInteger(value.falseSuccessDetections) || Number(value.falseSuccessDetections) < 0) errors.push(`sample ${index} falseSuccessDetections is invalid`);
  if (value.falseSuccessDetectionSource !== "contract_tests") errors.push(`sample ${index} falseSuccessDetectionSource is invalid`);
  try {
    const rebuilt = summarizeLifecycleTrace({
      runId: "validation-placeholder",
      mode: value.mode,
      source: value.source,
      statuses: value.statuses,
      falseSuccessDetections: value.falseSuccessDetections,
      falseSuccessDetectionSource: value.falseSuccessDetectionSource
    });
    for (const field of ["phases", "transitions", "gates", "blocks", "resumes", "validationRuns", "reviewRuns", "buildResolutionCycles", "assureResolutionCycles", "terminalStatus"]) {
      if (JSON.stringify(value[field]) !== JSON.stringify(rebuilt[field])) errors.push(`sample ${index} ${field} is inconsistent with statuses`);
    }
  } catch (error) {
    errors.push(`sample ${index} trace invalid: ${error instanceof Error ? error.message : "unknown"}`);
  }
  if (!isUnavailable(value.tokenUsage)) errors.push(`sample ${index} tokenUsage must be unavailable for P0 fixture`);
  if (!isUnavailable(value.latency)) errors.push(`sample ${index} latency must be unavailable for P0 fixture`);
}
function validateMeasurementSource(metric, measurement, source) {
  const valid = TOKEN_METRICS.has(metric) && measurement === "measured" && source === "native_token_api" || TOKEN_METRICS.has(metric) && measurement === "estimated" && source === "explicit_token_estimate" || metric === "token_proxy_context_bytes" && measurement === "estimated" && source === "context_bytes_proxy" || (metric === "latency_ms" || metric === "resume_to_first_action_ms") && measurement === "measured" && source === "monotonic_clock" || metric === "false_success_detections" && measurement === "measured" && source === "operator_audit" || ["unused_phase_outputs", "duplicated_fields", "silent_resume_divergences"].includes(metric) && measurement === "measured" && source === "operator_audit" || [
    "model_calls",
    "delegations",
    "context_bytes",
    "capsule_reuses",
    "capsule_invalidations",
    "review_lanes",
    "human_confirmations",
    "routing_decisions",
    "intake_questions",
    "intake_questions_avoided",
    "intake_recommendations_accepted",
    "intake_recommendations_modified",
    "intake_zero_question_paths",
    "intake_late_reopenings",
    "mode_changes"
  ].includes(metric) && measurement === "measured" && source === "orchestrator_counter" || ["validation_runs", "correction_cycles", "gates", "blocks", "transition_errors"].includes(metric) && measurement === "measured" && source === "state_history";
  if (!valid) throw new Error(`Metric ${metric} measurement/source mismatch.`);
}
function validateDimensions(input) {
  if (input.metric === "model_calls") {
    if (!ALLOWED_MODEL_IDS.includes(String(input.model)) || !REASONING_EFFORTS.includes(String(input.effort))) {
      throw new Error("model_calls requires allowlisted model and effort dimensions.");
    }
  } else if (input.model !== void 0 || input.effort !== void 0) {
    throw new Error(`Metric ${input.metric} cannot contain model or effort dimensions.`);
  }
  if (input.metric === "model_calls" || input.metric === "routing_decisions") {
    if (!["normal", "warning", "critical", "unknown"].includes(String(input.quotaPressure))) throw new Error(`${input.metric} requires quotaPressure dimension.`);
  } else if (input.quotaPressure !== void 0) {
    throw new Error(`Metric ${input.metric} cannot contain quotaPressure dimension.`);
  }
}
function validateTokenUsage(value) {
  if (!nonNegativeFinite(value.inputTokens) || !nonNegativeFinite(value.outputTokens)) throw new Error("Token usage values are invalid.");
  validateMeasurementSource("input_tokens", value.measurement, value.source);
  return { availability: "available", ...value };
}
function validateLatency(input) {
  if (!isRecord7(input) || Object.keys(input).some((key) => !["value", "measurement", "source"].includes(key)) || Object.keys(input).length !== 3 || !nonNegativeFinite(input.value) || input.measurement !== "measured" || input.source !== "monotonic_clock") throw new Error("Latency observation is invalid or mislabeled.");
  return { availability: "available", ...input };
}
function tracePhase(status, statuses, index) {
  const rule = STATE_MACHINE[status].macroPhase;
  if (MACRO_PHASES.includes(rule)) return rule;
  if (index === 0) throw new Error(`Cannot derive trace phase for ${status}.`);
  return tracePhase(statuses[index - 1], statuses, index - 1);
}
function unique(values) {
  return values.filter((value, index) => values.indexOf(value) === index);
}
function exactKeys(value, expected, label, errors) {
  const extras = Object.keys(value).filter((key) => !expected.includes(key));
  const missing = expected.filter((key) => !Object.hasOwn(value, key));
  if (extras.length) errors.push(`${label} has unknown fields: ${extras.join(", ")}`);
  if (missing.length) errors.push(`${label} lacks fields: ${missing.join(", ")}`);
}
function isUnavailable(value) {
  return isRecord7(value) && Object.keys(value).length === 1 && value.availability === "unavailable";
}
function isTaskMode2(value) {
  return value === "quick" || value === "standard" || value === "critical";
}
function isIsoDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && !Number.isNaN(Date.parse(value));
}
function isUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function nonNegativeFinite(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
function nonEmpty2(value) {
  return typeof value === "string" && value.length > 0;
}
function isRecord7(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function sha256(value) {
  return createHash2("sha256").update(value).digest("hex");
}

// src/fingerprint.ts
import { createHash as createHash3, randomUUID as randomUUID5 } from "node:crypto";
function fingerprintFailure(input) {
  const canonical = {
    check: input.check,
    stage: input.stage,
    errorType: input.errorType,
    path: input.path,
    symbol: input.symbol,
    messagePattern: input.messagePattern,
    rawMessage: "[redacted]"
  };
  const issueId = createHash3("sha256").update(JSON.stringify(canonical)).digest("hex");
  return { issueId, occurrenceId: randomUUID5(), canonical };
}
function nextCorrectionAction(input) {
  if (input.codeChanges < 2) return "debug";
  if (input.codeChanges === 2) return input.investigated ? "retry" : "investigate";
  return "human_gate";
}

// src/intake.ts
import { createHash as createHash4 } from "node:crypto";
var MAX_TEXT = 2e3;
var MAX_LIST = 32;
var SECRET2 = /\b(?:sk-[A-Za-z0-9_-]{8,}|(?:api[_-]?key|token|password|secret)\s*[:=]\s*\S+)\b/gi;
var EMAIL2 = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
var PHONE = /(?<!\d)(?:\+\d{8,15}|\d{3}[ .()-]\d{3}[ .()-]\d{4})(?!\d)/g;
var DELEGATION_ANSWER = /^(?:you decide|decide for me|choose for me|à toi de décider|décide(?:z)? pour moi|comme tu veux)$/i;
var ADVANCE_ANSWER = /^(?:next|continue|go ahead|shape|(?:passe|passer|avance|avancer).*(?:étape|etape|stage|shape|suite).*)$/i;
function applyInitialIntakeEvaluation(state, evaluation, at2) {
  assertIntakeWritable(state);
  if (state.intake?.activeQuestion) throw new Error("Initial Intake evaluation cannot replace an active question.");
  const intake = state.intake ?? createIntakeState({
    mode: state.mode,
    risk: defaultRisk(state.mode),
    sourceRefs: ["request"],
    freshnessRefs: ["state:configSnapshot", "state:policySnapshot"],
    ...at2 ? { capturedAt: at2 } : {}
  });
  const brief = sanitizeBrief(evaluation.brief);
  if (brief.mode !== state.mode) throw new Error("Intake Brief mode must match task mode.");
  const decisions = evaluation.resolvedDecisions.map(validateDecision);
  if (decisions.some((decision) => decision.source === "user" && decision.provenanceRef !== "request")) {
    throw new Error("Initial user decisions must be attributable to explicit request.");
  }
  const contradictions = evaluation.contradictions.map(sanitizeText).filter(Boolean);
  const nextQuestion = evaluation.nextQuestion ? validateDecisionQuestion(evaluation.nextQuestion, { ...intake, decisions, answeredDecisionKeys: decisions.map((item) => item.key) }) : void 0;
  const candidate = {
    schemaVersion: 1,
    brief,
    ...nextQuestion ? { activeQuestion: nextQuestion } : {},
    decisions,
    answeredDecisionKeys: unique2(decisions.map((item) => item.key)),
    invalidations: intake.invalidations,
    contradictions,
    semanticComplete: evaluation.semanticComplete,
    deterministicComplete: false,
    checkpointDue: false,
    semanticRetryCount: intake.semanticRetryCount,
    metrics: {
      ...updateMetrics(intake.metrics, decisions, evaluation),
      questionsAsked: nextQuestion ? 1 : 0,
      distinctQuestions: nextQuestion ? 1 : 0,
      zeroQuestionPath: !nextQuestion
    }
  };
  const completeness = evaluateIntakeCompleteness(candidate);
  candidate.deterministicComplete = completeness.complete;
  const updated = { ...state, intake: candidate };
  assertTaskState(updated);
  const persisted = recordHistoryEvent(updated, {
    type: nextQuestion ? "intake.question_recorded" : "context.updated",
    refs: nextQuestion ? [{ kind: "decision", ref: compactEventRef(nextQuestion.decisionKey) }] : [{ kind: "context", ref: "state:intake" }],
    ...at2 ? { at: at2 } : {}
  });
  return { state: persisted, completeness };
}
function createIntakeState(input) {
  const brief = sanitizeBrief({
    schemaVersion: 1,
    ...input.objective ? { objective: input.objective } : {},
    ...input.successSignal ? { successSignal: input.successSignal } : {},
    mode: input.mode,
    risk: input.risk,
    provenance: {
      sourceRefs: input.sourceRefs ?? [],
      capturedAt: normalizeAt2(input.capturedAt),
      freshnessRefs: input.freshnessRefs ?? []
    },
    technicalUnknowns: []
  });
  return {
    schemaVersion: 1,
    brief,
    decisions: [],
    answeredDecisionKeys: [],
    invalidations: [],
    contradictions: [],
    semanticComplete: false,
    deterministicComplete: false,
    checkpointDue: false,
    semanticRetryCount: 0,
    metrics: emptyMetrics()
  };
}
function setDecisionQuestion(state, question, at2) {
  assertIntakeWritable(state);
  const intake = state.intake ?? createIntakeState({
    mode: state.mode,
    risk: defaultRisk(state.mode),
    sourceRefs: ["request"],
    freshnessRefs: ["state:configSnapshot", "state:policySnapshot"],
    ...at2 ? { capturedAt: at2 } : {}
  });
  if (intake.activeQuestion) throw new Error("Active Decision Question must be answered or cancelled before another question.");
  const normalized = validateDecisionQuestion(question, intake);
  const distinct = !intake.answeredDecisionKeys.includes(normalized.decisionKey);
  const updated = {
    ...state,
    intake: {
      ...intake,
      activeQuestion: normalized,
      semanticComplete: false,
      deterministicComplete: false,
      checkpointDue: false,
      semanticRetryCount: intake.semanticRetryCount,
      metrics: {
        ...intake.metrics,
        questionsAsked: intake.metrics.questionsAsked + 1,
        distinctQuestions: intake.metrics.distinctQuestions + (distinct ? 1 : 0),
        zeroQuestionPath: false
      }
    }
  };
  assertTaskState(updated);
  return recordHistoryEvent(updated, {
    type: "intake.question_recorded",
    refs: [{ kind: "decision", ref: compactEventRef(normalized.decisionKey) }],
    ...at2 ? { at: at2 } : {}
  });
}
function applyIntakeResponse(state, answer, evaluation, at2) {
  assertIntakeWritable(state);
  const intake = state.intake;
  if (!intake?.activeQuestion) throw new Error("No active Decision Question exists.");
  const safeAnswer = sanitizeText(answer);
  if (!safeAnswer || DELEGATION_ANSWER.test(safeAnswer) || ADVANCE_ANSWER.test(safeAnswer)) {
    throw new Error(`Explicit answer required for decision ${intake.activeQuestion.decisionKey}.`);
  }
  if (!Array.isArray(evaluation.resolvedDecisions) || !Array.isArray(evaluation.contradictions)) {
    throw new Error("Intake model evaluation is structurally invalid.");
  }
  const brief = sanitizeBrief(evaluation.brief);
  const resolved = evaluation.resolvedDecisions.map(validateDecision);
  const modeDecision = resolved.find((decision) => decision.key === "mode" && decision.source === "user");
  const modeChanged = brief.mode !== state.mode;
  if (modeChanged && !modeDecision) {
    throw new Error("Intake Brief mode change requires an explicit user mode decision.");
  }
  if (modeChanged && state.history.some((event) => event.type === "state.transition" && event.mode === void 0)) {
    throw new Error("Mode change requires transition history with mode provenance.");
  }
  const resolutionKeys = new Set(resolved.map((item) => item.key));
  const activeResolved = resolutionKeys.has(intake.activeQuestion.decisionKey);
  let nextQuestion;
  if (evaluation.nextQuestion) {
    const { activeQuestion: _activeQuestion, ...intakeWithoutQuestion } = intake;
    const base = {
      ...intakeWithoutQuestion,
      decisions: mergeDecisions(intake.decisions, resolved),
      answeredDecisionKeys: unique2([...intake.answeredDecisionKeys, ...resolved.map((item) => item.key)])
    };
    nextQuestion = validateDecisionQuestion(evaluation.nextQuestion, base);
    if (!activeResolved && nextQuestion.decisionKey !== intake.activeQuestion.decisionKey) {
      throw new Error(`Unresolved decision ${intake.activeQuestion.decisionKey} must remain active.`);
    }
    if (!activeResolved) {
      nextQuestion = {
        ...nextQuestion,
        clarificationCount: intake.activeQuestion.clarificationCount + 1
      };
    }
  } else if (!activeResolved) {
    throw new Error(`Evaluation neither resolved nor clarified decision ${intake.activeQuestion.decisionKey}.`);
  }
  const answeredDecisionKeys = unique2([...intake.answeredDecisionKeys, ...resolved.map((item) => item.key)]);
  const contradictions = evaluation.contradictions.map(sanitizeText).filter(Boolean);
  const metrics = {
    ...updateMetrics(intake.metrics, resolved, evaluation),
    modeChanges: intake.metrics.modeChanges + (modeChanged ? 1 : 0)
  };
  const checkpointDue = metrics.distinctQuestions > 0 && metrics.distinctQuestions % 5 === 0 && answeredDecisionKeys.length >= metrics.distinctQuestions;
  const candidate = {
    schemaVersion: 1,
    brief,
    ...nextQuestion ? { activeQuestion: nextQuestion } : {},
    decisions: mergeDecisions(intake.decisions, resolved),
    answeredDecisionKeys,
    invalidations: intake.invalidations,
    contradictions,
    semanticComplete: evaluation.semanticComplete,
    deterministicComplete: false,
    checkpointDue,
    semanticRetryCount: intake.semanticRetryCount,
    ...nextQuestion && nextQuestion.clarificationCount >= 2 && !activeResolved ? { blockedReason: "answer_required" } : {},
    metrics
  };
  const completeness = evaluateIntakeCompleteness(candidate);
  candidate.deterministicComplete = completeness.complete;
  const updated = {
    ...state,
    ...modeChanged ? {
      mode: brief.mode,
      modeEvidenceRef: modeDecision?.provenanceRef ?? state.modeEvidenceRef,
      routingDecisions: []
    } : {},
    intake: candidate
  };
  assertTaskState(updated);
  let persisted = recordHistoryEvent(updated, {
    type: "intake.answer_recorded",
    refs: resolved.length ? resolved.slice(0, 16).map((item) => ({ kind: "decision", ref: compactEventRef(item.key) })) : [{ kind: "decision", ref: compactEventRef(intake.activeQuestion.decisionKey) }],
    ...at2 ? { at: at2 } : {}
  });
  if (checkpointDue) {
    persisted = recordHistoryEvent(persisted, {
      type: "intake.checkpoint",
      refs: [{ kind: "context", ref: "state:intake" }],
      ...at2 ? { at: at2 } : {}
    });
  }
  return {
    state: persisted,
    completeness,
    ...checkpointDue ? {
      checkpoint: {
        ...brief.objective ? { objective: brief.objective } : {},
        ...brief.successSignal ? { success: brief.successSignal.description } : {},
        mode: brief.mode,
        risk: brief.risk,
        answeredDecisionKeys
      }
    } : {}
  };
}
function evaluateIntakeCompleteness(intake) {
  const missingDecisionKeys = [];
  const reasons = [];
  if (!nonEmpty3(intake.brief.objective)) missingDecisionKeys.push("objective");
  if (!intake.brief.successSignal || !nonEmpty3(intake.brief.successSignal.description) || !nonEmpty3(intake.brief.successSignal.observationMethod)) {
    missingDecisionKeys.push("success_signal");
  }
  if (!["quick", "standard", "critical"].includes(intake.brief.mode)) missingDecisionKeys.push("mode");
  if (!["low", "medium", "high", "critical"].includes(intake.brief.risk)) missingDecisionKeys.push("risk");
  if (intake.activeQuestion) reasons.push(`active_question:${intake.activeQuestion.decisionKey}`);
  if (intake.contradictions.length) reasons.push("contradictions");
  if (!intake.semanticComplete) reasons.push("semantic_incomplete");
  if (!intake.brief.technicalUnknowns.every(validTechnicalUnknown)) reasons.push("untyped_technical_unknown");
  return {
    complete: missingDecisionKeys.length === 0 && reasons.length === 0,
    missingDecisionKeys: unique2(missingDecisionKeys),
    reasons
  };
}
function attestIntakeComplete(state, evidenceRef) {
  const intake = state.intake;
  if (!intake) throw new Error("Intake state is missing.");
  const result = evaluateIntakeCompleteness(intake);
  if (!result.complete || !intake.deterministicComplete) {
    const missing = [...result.missingDecisionKeys, ...result.reasons];
    throw new Error(`INTAKE incomplete: ${missing.join(", ")}.`);
  }
  return createGuardAttestation(state, "intake_complete", {
    observedFingerprint: `sha256:${digest2(intake)}`,
    evidenceRefs: [evidenceRef],
    provenance: "deterministic-check"
  });
}
function rejectPrematureAdvance(state, at2) {
  assertIntakeWritable(state);
  const intake = state.intake;
  if (!intake) throw new Error("Intake state is missing.");
  const completeness = evaluateIntakeCompleteness(intake);
  if (completeness.complete) return state;
  const missing = intake.activeQuestion?.decisionKey ?? completeness.missingDecisionKeys[0] ?? completeness.reasons[0] ?? "intake_context";
  return recordHistoryEvent(state, {
    type: "advance.rejected",
    refs: [{ kind: "decision", ref: compactEventRef(missing) }],
    ...at2 ? { at: at2 } : {}
  });
}
function invalidateIntakeDecisions(state, decisionKeys, reason, at2) {
  if (!state.intake) throw new Error("Intake state is missing.");
  const keys = unique2(decisionKeys.map(sanitizeText).filter(Boolean));
  if (!keys.length || !nonEmpty3(sanitizeText(reason))) throw new Error("Intake invalidation requires decision keys and reason.");
  const timestamp = normalizeAt2(at2);
  const invalidations = keys.map((decisionKey) => ({
    decisionKey,
    reason: sanitizeText(reason),
    at: timestamp
  }));
  const updated = {
    ...state,
    intake: {
      ...state.intake,
      decisions: state.intake.decisions.filter((decision) => !keys.includes(decision.key)),
      answeredDecisionKeys: state.intake.answeredDecisionKeys.filter((key) => !keys.includes(key)),
      invalidations: [...state.intake.invalidations, ...invalidations].slice(-MAX_LIST),
      semanticComplete: false,
      deterministicComplete: false,
      checkpointDue: false,
      semanticRetryCount: state.intake.semanticRetryCount,
      metrics: { ...state.intake.metrics, lateReopenings: state.intake.metrics.lateReopenings + 1 }
    }
  };
  assertTaskState(updated);
  return recordHistoryEvent(updated, {
    type: "intake.reopened",
    refs: keys.slice(0, 16).map((key) => ({ kind: "decision", ref: compactEventRef(key) })),
    at: timestamp
  });
}
function attestIntakeReopened(state, evidenceRef) {
  if (!state.intake || state.intake.semanticComplete || state.intake.deterministicComplete || !state.intake.invalidations.length) {
    throw new Error("INTAKE reopen requires persisted product-context invalidation.");
  }
  return createGuardAttestation(state, "intake_reopened", {
    observedFingerprint: `sha256:${digest2(state.intake.invalidations.at(-1))}`,
    evidenceRefs: [evidenceRef],
    provenance: "deterministic-check"
  });
}
function routeLateUnknown(kind) {
  return kind === "product" ? "INTAKE" : "SHAPE";
}
function recordInvalidIntakeModelOutput(state) {
  assertIntakeWritable(state);
  if (!state.intake) throw new Error("Intake state is missing.");
  if (state.intake.semanticRetryCount === 0) {
    const updated2 = {
      ...state,
      intake: { ...state.intake, semanticRetryCount: 1 }
    };
    assertTaskState(updated2);
    return { state: updated2, action: "retry_semantic" };
  }
  const updated = {
    ...state,
    intake: {
      ...state.intake,
      semanticComplete: false,
      deterministicComplete: false,
      blockedReason: "semantic_output_invalid"
    }
  };
  assertTaskState(updated);
  return { state: updated, action: "block" };
}
function isQuickEligible(input) {
  return input.boundedScope && input.nonDestructive && input.technicallyLocalizable && input.executableWithoutDesignDecision && input.verifiable;
}
function validateDecisionQuestion(question, intake) {
  if (question.schemaVersion !== 1) throw new Error("Decision Question schemaVersion must be 1.");
  const id = sanitizeText(question.id);
  const decisionKey = sanitizeText(question.decisionKey);
  const missingInformation = sanitizeText(question.missingInformation);
  const determiningImpact = sanitizeText(question.determiningImpact);
  const prompt = sanitizeText(question.prompt);
  const recommendationBasis = sanitizeText(question.recommendationBasis);
  if (![id, decisionKey, missingInformation, determiningImpact, prompt, recommendationBasis].every(nonEmpty3)) {
    throw new Error("Decision Question requires id, decisionKey, missing information, determining impact, prompt, and recommendation basis.");
  }
  if (intake.answeredDecisionKeys.includes(decisionKey)) throw new Error(`Decision ${decisionKey} was already answered.`);
  if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 3) {
    throw new Error("Decision Question requires 2\u20133 mutually exclusive options.");
  }
  const options = question.options.map((option) => ({
    id: sanitizeText(option.id),
    label: sanitizeText(option.label),
    impact: sanitizeText(option.impact)
  }));
  if (options.some((option) => !option.id || !option.label || !option.impact) || new Set(options.map((option) => option.id)).size !== options.length) {
    throw new Error("Decision Question options must have unique IDs, labels, and impacts.");
  }
  if (!options.some((option) => option.id === question.recommendedOptionId)) {
    throw new Error("Recommended option must reference one offered option.");
  }
  if (options[0]?.id !== question.recommendedOptionId) {
    throw new Error("Recommended option must be listed first.");
  }
  if (question.freeFormAllowed !== true) throw new Error("Decision Question must allow free-form input.");
  if (!["high", "medium", "low"].includes(question.recommendationConfidence)) throw new Error("Decision Question recommendation confidence is invalid.");
  if (!Number.isInteger(question.clarificationCount) || question.clarificationCount < 0 || question.clarificationCount > 2) {
    throw new Error("Decision Question clarificationCount must be 0\u20132.");
  }
  return {
    schemaVersion: 1,
    id,
    decisionKey,
    missingInformation,
    determiningImpact,
    prompt,
    options,
    recommendedOptionId: sanitizeText(question.recommendedOptionId),
    recommendationBasis,
    recommendationConfidence: question.recommendationConfidence,
    freeFormAllowed: true,
    clarificationCount: question.clarificationCount
  };
}
function validateDecision(value) {
  const decision = {
    key: sanitizeText(value.key),
    value: sanitizeText(value.value),
    source: value.source,
    provenanceRef: sanitizeText(value.provenanceRef),
    recommendationDisposition: value.recommendationDisposition,
    dependsOn: unique2((value.dependsOn ?? []).map(sanitizeText).filter(Boolean)).slice(0, MAX_LIST)
  };
  if (!decision.key || !decision.value || !decision.provenanceRef) throw new Error("Normalized decision requires key, value, and provenance.");
  if (!["user", "repository"].includes(decision.source)) throw new Error("Normalized decision source is invalid.");
  if (!["accepted", "modified", "not_applicable"].includes(decision.recommendationDisposition)) throw new Error("Recommendation disposition is invalid.");
  return decision;
}
function sanitizeBrief(value) {
  if (!value || value.schemaVersion !== 1) throw new Error("Intake Brief schemaVersion must be 1.");
  const technicalUnknowns = (value.technicalUnknowns ?? []).map((unknown) => ({
    key: sanitizeText(unknown.key),
    kind: unknown.kind,
    description: sanitizeText(unknown.description),
    owner: "shape"
  })).slice(0, MAX_LIST);
  if (!technicalUnknowns.every(validTechnicalUnknown)) throw new Error("Technical unknowns must be typed and owned by SHAPE.");
  const brief = {
    schemaVersion: 1,
    ...nonEmpty3(sanitizeText(value.objective)) ? { objective: sanitizeText(value.objective) } : {},
    ...value.successSignal ? {
      successSignal: {
        description: sanitizeText(value.successSignal.description),
        observationMethod: sanitizeText(value.successSignal.observationMethod),
        ...nonEmpty3(sanitizeText(value.successSignal.validator)) ? { validator: sanitizeText(value.successSignal.validator) } : {},
        ...value.successSignal.guardrails?.length ? { guardrails: sanitizeList(value.successSignal.guardrails) } : {}
      }
    } : {},
    mode: value.mode,
    risk: value.risk,
    provenance: {
      sourceRefs: sanitizeList(value.provenance?.sourceRefs ?? []),
      capturedAt: normalizeAt2(value.provenance?.capturedAt),
      freshnessRefs: sanitizeList(value.provenance?.freshnessRefs ?? [])
    },
    technicalUnknowns,
    ...optionalText("successValidator", value.successValidator),
    ...optionalList("successGuardrails", value.successGuardrails),
    ...optionalList("determiningConstraints", value.determiningConstraints),
    ...optionalList("affectedUsers", value.affectedUsers),
    ...optionalText("motivation", value.motivation),
    ...optionalText("urgency", value.urgency),
    ...optionalList("scopeBoundaries", value.scopeBoundaries)
  };
  if (!["quick", "standard", "critical"].includes(brief.mode)) throw new Error("Intake Brief mode is invalid.");
  if (!["low", "medium", "high", "critical"].includes(brief.risk)) throw new Error("Intake Brief risk is invalid.");
  return brief;
}
function mergeDecisions(existing, incoming) {
  const merged = new Map(existing.map((item) => [item.key, item]));
  for (const item of incoming) merged.set(item.key, item);
  return [...merged.values()].slice(-MAX_LIST);
}
function updateMetrics(current, decisions, evaluation) {
  return {
    ...current,
    modelCalls: current.modelCalls + 1,
    questionsAvoided: current.questionsAvoided + Math.max(0, evaluation.questionsAvoided ?? 0),
    recommendationsAccepted: current.recommendationsAccepted + decisions.filter((item) => item.recommendationDisposition === "accepted").length,
    recommendationsModified: current.recommendationsModified + decisions.filter((item) => item.recommendationDisposition === "modified").length,
    ...evaluation.inputTokens === void 0 ? {} : { inputTokens: (current.inputTokens ?? 0) + nonNegativeInteger(evaluation.inputTokens) },
    ...evaluation.outputTokens === void 0 ? {} : { outputTokens: (current.outputTokens ?? 0) + nonNegativeInteger(evaluation.outputTokens) },
    ...evaluation.latencyMs === void 0 ? {} : { latencyMs: (current.latencyMs ?? 0) + nonNegativeInteger(evaluation.latencyMs) }
  };
}
function emptyMetrics() {
  return {
    modelCalls: 0,
    questionsAsked: 0,
    questionsAvoided: 0,
    distinctQuestions: 0,
    recommendationsAccepted: 0,
    recommendationsModified: 0,
    zeroQuestionPath: true,
    lateReopenings: 0,
    modeChanges: 0
  };
}
function assertIntakeWritable(state) {
  assertTaskState(state);
  if (deriveMacroPhase(state) !== "INTAKE") throw new Error("Decision Questions may be changed only in INTAKE.");
}
function assertTaskState(state) {
  const result = validateStateV2(state);
  if (!result.valid) throw new Error(`Task state is invalid: ${JSON.stringify(result.errors.slice(0, 3))}`);
}
function validTechnicalUnknown(value) {
  return nonEmpty3(value.key) && ["code", "dependency", "architecture", "validation", "operations"].includes(value.kind) && nonEmpty3(value.description) && value.owner === "shape";
}
function sanitizeText(value) {
  if (typeof value !== "string") return "";
  return value.replace(SECRET2, "[REDACTED]").replace(EMAIL2, "[REDACTED_EMAIL]").replace(PHONE, "[REDACTED_PHONE]").replace(/[\0\r\n]+/g, " ").trim().slice(0, MAX_TEXT);
}
function sanitizeList(values) {
  return unique2(values.map(sanitizeText).filter(Boolean)).slice(0, MAX_LIST);
}
function optionalText(key, value) {
  const safe = sanitizeText(value);
  return safe ? { [key]: safe } : {};
}
function optionalList(key, value) {
  const safe = sanitizeList(value ?? []);
  return safe.length ? { [key]: safe } : {};
}
function compactEventRef(value) {
  const safe = value.replace(/[^A-Za-z0-9._:/#@+~=-]/g, "-").replace(/^-+/, "").slice(0, 400);
  return safe || `sha256:${digest2(value)}`;
}
function normalizeAt2(value) {
  if (value && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  return (/* @__PURE__ */ new Date()).toISOString();
}
function defaultRisk(mode) {
  return mode === "critical" ? "critical" : mode === "standard" ? "medium" : "low";
}
function unique2(values) {
  return [...new Set(values)];
}
function nonNegativeInteger(value) {
  if (!Number.isFinite(value) || value < 0) throw new Error("Metric value must be non-negative.");
  return Math.round(value);
}
function nonEmpty3(value) {
  return typeof value === "string" && value.length > 0;
}
function digest2(value) {
  return createHash4("sha256").update(JSON.stringify(canonicalize2(value))).digest("hex");
}
function canonicalize2(value) {
  if (Array.isArray(value)) return value.map(canonicalize2);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, nested]) => [key, canonicalize2(nested)]));
  }
  return value;
}

// src/worktree.ts
function decideWorktree(context) {
  if (context.mode === "critical") return { required: true, reason: "critical" };
  if (context.requested) return { required: true, reason: "requested" };
  if (context.concurrent) return { required: true, reason: "concurrent" };
  if (!context.checkoutSafe) return { required: true, reason: "unsafe" };
  return { required: false, reason: "none" };
}

// src/commands.ts
import { existsSync as existsSync3, readFileSync as readFileSync3 } from "node:fs";
import { fileURLToPath as fileURLToPath2 } from "node:url";
function discoverVerificationCommands(root) {
  const path = fileURLToPath2(root);
  const agents = path + "/AGENTS.md";
  const guided = existsSync3(agents) ? readFileSync3(agents, "utf8").match(/npm run [\w:-]+|npm test/g) ?? [] : [];
  const manifest = path + "/package.json";
  const scripts = existsSync3(manifest) ? JSON.parse(readFileSync3(manifest, "utf8")).scripts ?? {} : {};
  if (guided.length) return { source: "AGENTS.md", commands: [...guided, ...scripts.test ? ["npm test"] : []] };
  return { source: "limited", commands: [] };
}

// src/bridge.ts
var ROUTED_STAGES = ["discover", "plan", "debug", "review", "verify"];
var MUTATING_STAGES = /* @__PURE__ */ new Set(["execute", "validate"]);
function isDelegableStage(stage) {
  return ROUTED_STAGES.includes(stage);
}
async function delegateStage(stage, runner, decision) {
  if (!isDelegableStage(stage) || MUTATING_STAGES.has(stage)) {
    throw new Error("Mutation and validation stages stay with the parent workflow; no delegation permitted.");
  }
  return runner(decision);
}

// src/cli.ts
async function runInvocation(argv, options = {}) {
  const invocation = parseInvocation(argv);
  if (invocation.command === "init") return runInit(options.init);
  if (invocation.command === "config_show" || invocation.command === "config_validate") {
    const config2 = resolveRuntimeConfig(options.configSources);
    return invocation.command === "config_show" ? { command: invocation.command, status: "ok", data: invocation.explain ? explainConfig(config2) : config2.value } : { command: invocation.command, status: "valid", data: { valid: true } };
  }
  if (invocation.command === "benchmark_summary") {
    const summary = await createBenchmarkStore(options.workspaceRoot ?? process.cwd()).summary();
    return { command: "benchmark_summary", status: "ok", data: summary };
  }
  if (invocation.command === "status") {
    if (!invocation.taskId) return { command: "status", status: "read-only", data: { taskId: void 0 } };
    const loaded = await createTaskStateStore(options.workspaceRoot ?? process.cwd()).load(invocation.taskId);
    return {
      command: "status",
      status: loaded.state.status,
      data: {
        taskId: invocation.taskId,
        mode: loaded.state.mode,
        macroPhase: deriveMacroPhase(loaded.state),
        benchmarkEnabled: loaded.state.benchmarkEnabled ?? false,
        migrationRequired: loaded.migrationRequired
      }
    };
  }
  const resumedState = invocation.command === "resume" ? await loadResumeStateIfPresent(options.workspaceRoot ?? process.cwd(), invocation.taskId) : void 0;
  const config = resolveRuntimeConfig(options.configSources);
  const capture = options.captureSnapshot ?? captureRoutingSnapshot;
  const subscription = isRecord8(config.value.subscription) ? config.value.subscription : {};
  const snapshotResult = await capture({
    ...options.appServer ?? {},
    config: {
      plan: typeof subscription.plan === "string" ? subscription.plan : "auto",
      ...typeof subscription.planOverride === "string" ? { planOverride: subscription.planOverride } : {},
      ...typeof subscription.multiplierOverride === "number" ? { multiplierOverride: subscription.multiplierOverride } : {},
      ...Array.isArray(subscription.modelAllowlist) ? { modelAllowlist: subscription.modelAllowlist.filter((model) => typeof model === "string") } : {},
      ...isRecord8(subscription.quota) ? {
        quota: {
          ...typeof subscription.quota.warningPercent === "number" ? { warningPercent: subscription.quota.warningPercent } : {},
          ...typeof subscription.quota.criticalPercent === "number" ? { criticalPercent: subscription.quota.criticalPercent } : {}
        }
      } : {}
    }
  });
  const nowEpochSeconds = options.nowEpochSeconds ?? Math.floor(Date.now() / 1e3);
  const quotaCachePath = resolveQuotaCachePath(options);
  let routingSnapshot = snapshotResult.snapshot;
  if (quotaCachePath) {
    if (routingSnapshot.quota.source === "app-server" && routingSnapshot.quota.windowDurationMins === 300 && routingSnapshot.quota.resetsAt !== void 0 && routingSnapshot.quota.resetsAt > nowEpochSeconds) {
      try {
        await writeFiveHourResetCache(quotaCachePath, {
          windowDurationMins: 300,
          resetsAt: routingSnapshot.quota.resetsAt
        });
      } catch {
        routingSnapshot = appendRoutingWarning(routingSnapshot, "quota_cache_write_failed");
      }
    } else {
      const cached = await readFiveHourResetCache(quotaCachePath, nowEpochSeconds);
      routingSnapshot = applyFiveHourResetFallback(routingSnapshot, cached);
    }
  }
  const mode = invocation.command === "run" ? invocation.mode : resumedState?.mode;
  const decisions = ROUTING_TASKS2.map((task) => chooseRoute(routingSnapshot, { ...task, ...mode ? { mode } : {} }));
  const unavailable = decisions.some((decision) => decision.model === null || decision.effort === null);
  const permissionRequired = snapshotResult.failure?.code === "app_server_permission_denied";
  return {
    command: invocation.command,
    status: permissionRequired ? "routing_permission_required" : unavailable ? "routing_unavailable" : snapshotResult.available ? "routed" : "routed_with_warning",
    data: {
      ...invocation.command === "run" ? { mode, objective: invocation.objective, benchmarkEnabled: invocation.flags.benchmark === true } : {
        taskId: invocation.taskId,
        benchmarkEnabled: resumedState?.benchmarkEnabled ?? false
      },
      routingSnapshot,
      routingPolicyVersion: ROUTING_POLICY_VERSION,
      routingDecisions: decisions,
      ...snapshotResult.failure ? { routingFailure: snapshotResult.failure } : {},
      ...snapshotResult.error ? { warning: snapshotResult.error } : {}
    }
  };
}
function appendRoutingWarning(snapshot, warning) {
  return snapshot.warnings.includes(warning) ? snapshot : { ...snapshot, warnings: [...snapshot.warnings, warning] };
}
function resolveQuotaCachePath(options) {
  if (options.quotaCachePath === false) return void 0;
  if (typeof options.quotaCachePath === "string") return options.quotaCachePath;
  if (options.captureSnapshot) return void 0;
  return resolve3(process.cwd(), ".codex", "tasks", "five-hour-quota-reset.json");
}
var ROUTING_TASKS2 = [
  { stage: "discover", risk: "medium", ambiguity: "medium" },
  { stage: "plan", risk: "medium", ambiguity: "medium" },
  { stage: "execute", risk: "medium", ambiguity: "medium" },
  { stage: "debug", risk: "medium", ambiguity: "medium" },
  { stage: "review", risk: "medium", ambiguity: "medium" },
  { stage: "verify", risk: "medium", ambiguity: "medium" }
];
function resolveRuntimeConfig(sources) {
  return resolveConfig(sources ?? loadConfigSources());
}
async function loadResumeStateIfPresent(workspaceRoot, taskId) {
  try {
    return (await createTaskStateStore(workspaceRoot).load(taskId)).state;
  } catch (error) {
    if (error instanceof StateStoreError && error.code === "state_not_found") return void 0;
    throw error;
  }
}
function isRecord8(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function main(argv = process.argv.slice(2)) {
  void runInvocation(argv).then(
    (result) => {
      if (result.command !== "init") process.stdout.write(JSON.stringify(result) + "\n");
    },
    (error) => {
      const exitCode = error instanceof InvocationError || isExitCodeError(error) ? error.exitCode : EXIT_CODES.INTERNAL_ERROR;
      process.stderr.write((error instanceof Error ? error.message : "Unexpected error.") + "\n");
      process.exitCode = exitCode;
    }
  );
}
function isExitCodeError(error) {
  return typeof error === "object" && error !== null && "exitCode" in error && typeof error.exitCode === "number";
}
if (import.meta.main) {
  main();
}
export {
  APP_SERVER_PROTOCOL_VERSION,
  AppServerClient,
  AppServerError,
  BENCHMARK_DIRECTORY,
  BenchmarkStore,
  ConfigValidationError,
  DEFAULT_CONFIG,
  DEFAULT_SUBSCRIPTION_CONFIG,
  EXIT_CODES,
  GUARD_IDS,
  HISTORY_LIMIT,
  HISTORY_REFERENCE_LIMIT,
  HISTORY_REFERENCE_TOTAL_CHARS,
  InvocationError,
  LIFECYCLE_METRICS,
  MACRO_PHASES,
  MODEL_COST_MULTIPLIERS,
  MODEL_COST_PROFILES,
  MODEL_IDS,
  PolicyError,
  ROUTED_STAGES,
  ROUTING_POLICY_VERSION,
  STATE_FILENAME,
  STATE_MACHINE,
  STATE_V1_BACKUP_FILENAME,
  StateMigrationError,
  StateStoreError,
  TASK_STATUSES,
  TaskStateStore,
  addRoutingDecision,
  applyFiveHourResetFallback,
  applyInitialIntakeEvaluation,
  applyIntakeResponse,
  applyPolicy,
  attestIntakeComplete,
  attestIntakeReopened,
  buildBaselineReport,
  buildRoutingPreview,
  buildRoutingSnapshot,
  buildStateMachineProjection,
  captureRoutingSnapshot,
  chooseRoute,
  classifyBenchmarkDeviations,
  classifyQuotaPressure,
  compareSnapshot,
  createBenchmarkRecord,
  createBenchmarkStore,
  createGateDecision,
  createGuardAttestation,
  createIntakeState,
  createLifecycleMetricEvent,
  createMetricRunId,
  createState,
  createTaskStateStore,
  createUnavailableRoutingSnapshot,
  decideWorktree,
  delegateStage,
  deriveMacroPhase,
  discoverVerificationCommands,
  evaluateCriticalCompletionApproval,
  evaluateHandoffIntent,
  evaluateHandoffReconciliation,
  evaluateIntakeCompleteness,
  evaluateVerification,
  explainConfig,
  fingerprintFailure,
  guardStateFingerprint,
  invalidateIntakeDecisions,
  isDelegableStage,
  isQuickEligible,
  loadConfigSources,
  main,
  migrateStateToV2,
  nextCorrectionAction,
  parseInvocation,
  readFiveHourResetCache,
  recordHistoryEvent,
  recordInvalidIntakeModelOutput,
  rejectPrematureAdvance,
  resolveConfig,
  resolveSubscriptionMultiplier,
  resolveSubscriptionPlan,
  routeLateUnknown,
  runInit,
  runInvocation,
  selectFiveHourWindow,
  selectObservedQuotaWindow,
  setDecisionQuestion,
  shouldOfferBenchmarkSurvey,
  summarizeBenchmarkRecords,
  summarizeLifecycleTrace,
  transition,
  tryCreateLifecycleMetricEvent,
  tryWriteBenchmarkRecord,
  updateResumeContext,
  validateBaselineReport,
  validateConfigSource,
  validateSchema,
  writeFiveHourResetCache
};
