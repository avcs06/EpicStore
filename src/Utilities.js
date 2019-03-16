export const freeze = object => {
    Object.freeze(object);
    Object.getOwnPropertyNames(object).forEach(function(prop) {
        if (object[prop] !== null
            && (typeof object[prop] === "object" || typeof object[prop] === "function")
            && !Object.isFrozen(object[prop])) {
            freeze(object[prop]);
        }
    });
    return object;
};

export const unfreeze = object => {
    const isArray = object.constructor === Array;
    const newObject = isArray ? [] : {};
    Object.getOwnPropertyNames(object).forEach(function(prop) {
        if (isArray && prop === 'length') return;

        newObject[prop] = object[prop];
        if (object[prop] !== null && (typeof object[prop] === "object")) {
            newObject[prop] = unfreeze(object[prop]);
        }
    });
    return newObject;
};
