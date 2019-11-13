export const MERGE_ERROR = 'MERGE_ERROR';
export const INITIAL_VALUE = Symbol('____ricochet_initial_value____');

const isArray = entry => entry.constructor === Array;
const isObject = entry => entry !== null && typeof entry === "object";

const getOwnProps = obj => [
    ...Object.getOwnPropertyNames(obj),
    ...(Object.getOwnPropertySymbols ? Object.getOwnPropertySymbols(obj) : [])
];

const propIt = (obj, method, ...args) => 
    getOwnProps(obj)[method](...args);

export const freeze = object => {
    if (isObject(object)) {
        Object.freeze(object);
        propIt(object, 'forEach', prop => freeze(object[prop]));
    }

    return object;
};

export const isEqual = (object1, object2) => {
    if (object1 !== object2) {
        if (isObject(object1) && isObject(object2)) {
            return (
                propIt(object1, 'every', prop => object2.hasOwnProperty(prop)) &&
                propIt(object2, 'every', prop => object1.hasOwnProperty(prop) && isEqual(object1[prop], object2[prop]))
            );
        }
        return false;
    }
    return true;
};

export const clone = object => {
    if (isObject(object)) {
        return propIt(object, 'reduce', (a, prop) => {
            a[prop] = clone(object[prop]); return a;
        }, isArray(object) ? [] : {});
    }

    return object;
};

const makeApplyChanges = changes => state =>
    changes.reduce((a, c) => { c(a); return a; }, state);

// Arrays will be considered as primitives when merging, full replace
export const merge = (_object, object, ignore = false) => {
    if (_object !== INITIAL_VALUE) {
        const _isObject = isObject(_object);
        if (isObject(object) === _isObject) {
            if (_isObject) {
                const _isArray = isArray(_object);
                if (isArray(object) === _isArray) {
                    if (!_isArray) {
                        const newObject = {};
                        const undoChanges = [];
                        const redoChanges = [];

                        new Set([...getOwnProps(_object), ...getOwnProps(object)]).forEach(prop => {
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
