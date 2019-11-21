import "core-js/es/symbol";

export const MERGE_ERROR = 'MERGE_ERROR';
export const INITIAL_VALUE = Symbol('____ricochet_initial_value____');

export const isArray = entry => entry.constructor === Array;
export const isObject = entry => entry !== null && typeof entry === "object";

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

// Arrays will be considered as primitives when merging, full replace
export const merge = (() => {
    const noop = s => s;
    const makeSetter = s => () => s;
    const makeSetProp = (prop, value) => s => s[prop] = value;
    const makeDeleteProp = prop => s => delete s[prop];
    const makePropSetter = (prop, setter) => s => s[prop] = setter(s[prop]);

    const defaultChanges = { undo: noop, redo: noop };
    const makeApplyChanges = changes => s =>
        changes.reduce((a, c) => { c(a); return a; }, s);

    return (_object, object, withUndo, internal = false) => {
        let changes = !internal && defaultChanges;
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
                                        const [updatedValue, changes] = merge(_entry, entry, withUndo, true);
                                        newObject[prop] = updatedValue;
                                        if (changes) {
                                            const { undo, redo } = changes;
                                            undoChanges.push(makePropSetter(prop, undo));
                                            redoChanges.push(makePropSetter(prop, redo));
                                        }
                                    } else {
                                        newObject[prop] = _entry;
                                    }
                                } else {
                                    newObject[prop] = entry;
                                    undoChanges.push(makeDeleteProp(prop));
                                    redoChanges.push(makeSetProp(prop, entry));
                                }
                            });

                            if (withUndo && undoChanges.length)
                                changes = {
                                    undo: makeApplyChanges(undoChanges),
                                    redo: makeApplyChanges(redoChanges)
                                };

                            return [newObject, changes];
                        }
                    } else if (!internal) {
                        throw MERGE_ERROR;
                    }
                }
            } else if (!(_isObject ? isArray(_object) : isArray(object)) && !internal) {
                throw MERGE_ERROR;
            }
        }

        if (withUndo && _object !== object)
            changes = {
                undo: makeSetter(_object),
                redo: makeSetter(object)
            };

        return [object, changes];
    };
})();
