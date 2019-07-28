import memoize from 'memoizee';

const isArray = entry => entry.constructor === Array;
const isObject = entry => entry !== null && typeof entry === "object";
export const initialValue = Symbol('initialValue');
export const MERGE_ERROR = 'MERGE_ERROR';

export const freeze = object => {
    if (isObject(object)) {
        Object.freeze(object);
        if (!isArray(object)) {
            Object.getOwnPropertyNames(object).forEach(prop => freeze(object[prop]));
        }
    }

    return object;
};

export const isEqual = (() => {
    let internalMemoizedIsEqual;
    const isEqual = (object1, object2) => {
        if (object1 !== object2) {
            const isObject1 = isObject(object1);
            const isObject2 = isObject(object2);
            if (isObject1 === isObject2) {
                if (!isObject1) return false;
                const props1 = Object.getOwnPropertyNames(object1);
                const props2 = Object.getOwnPropertyNames(object2);
                return (
                    props1.every(
                        prop => object2.hasOwnProperty(prop) &&
                        internalMemoizedIsEqual(object1[prop], object2[prop])
                    ) && props2.every(prop => object1.hasOwnProperty(prop))
                );
            }
            return false;
        }
        return true;
    };

    return (object1, object2) => {
        internalMemoizedIsEqual = memoize(isEqual);
        return internalMemoizedIsEqual(object1, object2);
    };
})();

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
        } else if (!(_isObject ? isArray(_object) : isArray(object)) && !ignore) {
            throw MERGE_ERROR;
        }
    }

    return [object, () => _object, () => object];
};
