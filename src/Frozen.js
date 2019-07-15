
import invariant from 'invariant';

const isArray = entry => entry.constructor === Array;
const isObject = entry => entry !== null && typeof entry === "object";
const shouldFreeze = entry => isObject(entry) || typeof entry === "function";
export const initialValue = Symbol('initialValue');

export const freeze = object => {
    if (shouldFreeze(object)) {
        Object.freeze(object);
        Object.getOwnPropertyNames(object).forEach(function(prop) {
            if (shouldFreeze(object[prop]) && !Object.isFrozen(object[prop])) {
                freeze(object[prop]);
            }
        });
    }

    return object;
};

export const unfreeze = (_object, object, error, ignore = false) => {
    let newObject = object;
    if (_object !== initialValue) {
        const _isObject = isObject(_object);
        if (isObject(object) === _isObject) {
            if (!_isObject) { return newObject; }

            const _isArray = isArray(_object);
            if (isArray(object) === _isArray) {
                newObject = _isArray ? [] : {};
                const _props = Object.getOwnPropertyNames(_object);
                const props = Object.getOwnPropertyNames(object);

                [..._props, ...props].forEach(function(prop) {
                    if (newObject.hasOwnProperty(prop) || _isArray && prop === 'length') return;

                    const _entry = _object[prop], entry = object[prop];
                    if (_object.hasOwnProperty(prop)) {
                        if (object.hasOwnProperty(prop)) {
                            newObject[prop] = unfreeze(_entry, entry, error, true);
                        } else if (isObject(_entry)) {
                            newObject[prop] = unfreeze(_entry, isArray(_entry) ? [] : {}, error, true);
                        } else {
                            newObject[prop] = _entry;
                        }
                    } else {
                        newObject[prop] = entry;
                    }
                });
            } else {
                invariant(ignore, error);
            }
        } else {
            invariant(ignore, error);
        }
    }

    return newObject;
};
