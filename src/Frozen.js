
import invariant from 'invariant';

const isArray = entry => entry.constructor === Array;
const isObject = entry => entry !== null && typeof entry === "object";
const shouldFreeze = entry => isObject(entry) || typeof entry === "function";
export const initialValue = Symbol('initialValue');
export const MERGE_ERROR = 'MERGE_ERROR';

export const freeze = object => {
    if (shouldFreeze(object)) {
        Object.freeze(object);
        Object.getOwnPropertyNames(object).forEach(function(prop) {
            freeze(object[prop]);
        });
    }

    return object;
};

export const clone = object => {
    if (object !== initialValue) {
        if (isObject(object)) {
            const _isArray = isArray(object);
            const newObject = _isArray ? [] : {};

            Object.getOwnPropertyNames(object).forEach(function (prop) {
                if (_isArray && prop === 'length') return;
                newObject[prop] = clone(object[prop]);
            });

            return newObject;
        }
    }

    return object;
};

const makeApplyChanges = changes => state =>
    changes.reduce((a, c) => { c(a); return a; }, state);

export const merge = (_object, object, ignore = false) => {
    if (_object !== initialValue) {
        const _isObject = isObject(_object);
        if (isObject(object) === _isObject) {
            if (_isObject) {
                const _isArray = isArray(_object);
                if (isArray(object) === _isArray) {
                    if (!_isArray) {
                        const newObject = {};
                        const undoChanges = [];
                        const redoChanges = [];
                        const _props = Object.getOwnPropertyNames(_object);
                        const props = Object.getOwnPropertyNames(object);

                        [..._props, ...props].forEach(function (prop) {
                            if (newObject.hasOwnProperty(prop)) return;

                            const _entry = _object[prop], entry = object[prop];
                            if (_object.hasOwnProperty(prop)) {
                                if (object.hasOwnProperty(prop)) {
                                    const [updatedValue, undoChange, redoChange] = merge(_entry, entry, true);
                                    newObject[prop] = updatedValue;
                                    undoChanges.push(s => s[prop] = undoChange(s[prop]));
                                    redoChanges.push(s => s[prop] = redoChange(s[prop]));
                                } else {
                                    newObject[prop] = _entry;
                                }
                            } else {
                                newObject[prop] = entry;
                                undoChanges.push(s => delete s[prop]);
                                redoChanges.push(s => s[prop] = entry);
                            }
                        });

                        return [newObject, makeApplyChanges(undoChanges), makeApplyChanges(redoChanges)];
                    }
                } else if (!ignore) {
                    throw MERGE_ERROR;
                }
            }
        } else if (!ignore) {
            throw MERGE_ERROR;
        }
    }

    return [object, () => _object, () => object];
};
