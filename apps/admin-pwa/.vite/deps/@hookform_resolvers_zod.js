import {
  require_react
} from "./chunk-RUSJVF2B.js";
import {
  __toESM
} from "./chunk-PX6F3LHL.js";

// ../../node_modules/react-hook-form/dist/index.esm.mjs
var import_react = __toESM(require_react(), 1);
var isDateObject = (value) => value instanceof Date;
var isNullOrUndefined = (value) => value == null;
var isObjectType = (value) => typeof value === "object";
var isObject = (value) => !isNullOrUndefined(value) && !Array.isArray(value) && isObjectType(value) && !isDateObject(value);
var FIELD_PATH_RE = /[.[\]'"]/;
var stringToPath = (input) => input.split(FIELD_PATH_RE).filter(Boolean);
var isWeb = typeof window !== "undefined" && typeof window.HTMLElement !== "undefined" && typeof document !== "undefined";
var VALIDATION_MODE = {
  onBlur: "onBlur",
  onChange: "onChange",
  onSubmit: "onSubmit",
  onTouched: "onTouched",
  all: "all"
};
var INPUT_VALIDATION_RULES = {
  max: "max",
  min: "min",
  maxLength: "maxLength",
  minLength: "minLength",
  pattern: "pattern",
  required: "required",
  validate: "validate"
};
var REGISTER_VALIDATION_RULES = [
  INPUT_VALIDATION_RULES.required,
  INPUT_VALIDATION_RULES.min,
  INPUT_VALIDATION_RULES.max,
  INPUT_VALIDATION_RULES.minLength,
  INPUT_VALIDATION_RULES.maxLength,
  INPUT_VALIDATION_RULES.pattern,
  INPUT_VALIDATION_RULES.validate
];
var PROTOTYPE_KEYWORDS = ["__proto__", "constructor", "prototype"];
var IS_KEY_RE = /^\w*$/;
var isKey = (value) => IS_KEY_RE.test(value);
var isUndefined = (val) => val === void 0;
var get = (object, path, defaultValue) => {
  if (!path || !isObject(object)) {
    return defaultValue;
  }
  const paths = isKey(path) ? [path] : stringToPath(path);
  if (paths.some((key) => PROTOTYPE_KEYWORDS.includes(key))) {
    return defaultValue;
  }
  const result = paths.reduce((result2, key) => {
    return isNullOrUndefined(result2) ? void 0 : result2[key];
  }, object);
  return isUndefined(result) || result === object ? isUndefined(object[path]) ? defaultValue : object[path] : result;
};
var set = (object, path, value) => {
  let index = -1;
  const tempPath = isKey(path) ? [path] : stringToPath(path);
  const length = tempPath.length;
  const lastIndex = length - 1;
  while (++index < length) {
    const key = tempPath[index];
    let newValue = value;
    if (index !== lastIndex) {
      const objValue = object[key];
      newValue = isObject(objValue) || Array.isArray(objValue) ? objValue : !isNaN(+tempPath[index + 1]) ? [] : {};
    }
    if (PROTOTYPE_KEYWORDS.includes(key)) {
      return;
    }
    object[key] = newValue;
    object = object[key];
  }
};
var HookFormControlContext = import_react.default.createContext(null);
HookFormControlContext.displayName = "HookFormControlContext";
var useIsomorphicLayoutEffect = isWeb ? import_react.default.useLayoutEffect : import_react.default.useEffect;
var appendErrors = (name, validateAllFieldCriteria, errors, type, message) => validateAllFieldCriteria ? {
  ...errors[name],
  types: {
    ...errors[name] && errors[name].types ? errors[name].types : {},
    [type]: message || true
  }
} : {};
var HookFormContext = import_react.default.createContext(null);
HookFormContext.displayName = "HookFormContext";
var defaultOptions = {
  mode: VALIDATION_MODE.onSubmit,
  reValidateMode: VALIDATION_MODE.onChange,
  shouldFocusError: true
};
var RESET_OPTIONS = {
  mode: defaultOptions.mode,
  reValidateMode: defaultOptions.reValidateMode,
  shouldFocusError: defaultOptions.shouldFocusError,
  resolver: void 0,
  criteriaMode: void 0,
  delayError: void 0,
  shouldUnregister: void 0,
  shouldUseNativeValidation: void 0,
  context: void 0
};

// ../../node_modules/@hookform/resolvers/dist/resolvers.mjs
var s = (e, s2, o2) => {
  if (e && "reportValidity" in e) {
    const r2 = get(o2, s2);
    e.setCustomValidity(r2 && r2.message || ""), e.reportValidity();
  }
};
var o = (t2, e) => {
  for (const o2 in e.fields) {
    const r2 = e.fields[o2];
    r2 && r2.ref && "reportValidity" in r2.ref ? s(r2.ref, o2, t2) : r2.refs && r2.refs.forEach((e2) => s(e2, o2, t2));
  }
};
var r = (s2, r2) => {
  r2.shouldUseNativeValidation && o(s2, r2);
  const f = {};
  for (const o2 in s2) {
    const n2 = get(r2.fields, o2), a = Object.assign(s2[o2] || {}, { ref: n2 && n2.ref });
    if (i(r2.names || Object.keys(s2), o2)) {
      const s3 = Object.assign({}, get(f, o2));
      set(s3, "root", a), set(f, o2, s3);
    } else set(f, o2, a);
  }
  return f;
};
var i = (t2, e) => t2.some((t3) => t3.startsWith(e + "."));

// ../../node_modules/@hookform/resolvers/zod/dist/zod.mjs
var n = function(r2, e) {
  for (var n2 = {}; r2.length; ) {
    var t2 = r2[0], s2 = t2.code, i2 = t2.message, a = t2.path.join(".");
    if (!n2[a]) if ("unionErrors" in t2) {
      var u = t2.unionErrors[0].errors[0];
      n2[a] = { message: u.message, type: u.code };
    } else n2[a] = { message: i2, type: s2 };
    if ("unionErrors" in t2 && t2.unionErrors.forEach(function(e2) {
      return e2.errors.forEach(function(e3) {
        return r2.push(e3);
      });
    }), e) {
      var c = n2[a].types, f = c && c[t2.code];
      n2[a] = appendErrors(a, e, n2, s2, f ? [].concat(f, t2.message) : t2.message);
    }
    r2.shift();
  }
  return n2;
};
var t = function(o2, t2, s2) {
  return void 0 === s2 && (s2 = {}), function(i2, a, u) {
    try {
      return Promise.resolve((function(e, n2) {
        try {
          var a2 = Promise.resolve(o2["sync" === s2.mode ? "parse" : "parseAsync"](i2, t2)).then(function(e2) {
            return u.shouldUseNativeValidation && o({}, u), { errors: {}, values: s2.raw ? i2 : e2 };
          });
        } catch (r2) {
          return n2(r2);
        }
        return a2 && a2.then ? a2.then(void 0, n2) : a2;
      })(0, function(r2) {
        if ((function(r3) {
          return Array.isArray(null == r3 ? void 0 : r3.errors);
        })(r2)) return { values: {}, errors: r(n(r2.errors, !u.shouldUseNativeValidation && "all" === u.criteriaMode), u) };
        throw r2;
      }));
    } catch (r2) {
      return Promise.reject(r2);
    }
  };
};
export {
  t as zodResolver
};
//# sourceMappingURL=@hookform_resolvers_zod.js.map
