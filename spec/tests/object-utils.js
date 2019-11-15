import * as ObjectUtils from '../../src/object-utils';

function verifyMerge(a, b, isObject) {
  const [updatedEntity, { undo, redo }] = ObjectUtils.merge(a, b, true);
  const expectedUpdatedEntity = isObject ? { ...a, ...b } : b;
  expect(updatedEntity).toEqual(expectedUpdatedEntity);
  expect(undo(updatedEntity)).toEqual(a);
  expect(redo(undo(updatedEntity))).toEqual(expectedUpdatedEntity);
}

describe("Object Utilities: Merge", function () {
  it("Primitive to Primitive", function () {
    verifyMerge(1, 'a');
  });

  it("Primitive to Object should throw", function () {
    expect(() => ObjectUtils.merge(1, { a: 1 })).toThrow('MERGE_ERROR');
  });

  it("Object to Primitive should throw", function () {
    expect(() => ObjectUtils.merge({ a: 1 }, 'a')).toThrow('MERGE_ERROR');
  });

  // Array will be considered as primitive
  it("primitive to Array", function () {
    verifyMerge(1, [1, 3, 5]);
  });

  it("Array to Primitive", function () {
    verifyMerge([1, 3, 5], 1);
  });

  it("Array to Array", function () {
    verifyMerge([1, 3, 5], [2, 4, 6]);
  });

  it("Array to Object should throw", function () {
    expect(() => ObjectUtils.merge([1, 3, 5], { a: 1 })).toThrow('MERGE_ERROR');
  });

  it("Object to Array should throw", function () {
    expect(() => ObjectUtils.merge({ a: 1 }, [1, 3, 5])).toThrow('MERGE_ERROR');
  });

  // INITIAL_VALUE will be considered primitive, with exception INITIAL_VALUE to object wont throw
  it("INITIAL_VALUE to primitive", function () {
    verifyMerge(ObjectUtils.INITIAL_VALUE, 1);
  });

  it("INITIAL_VALUE to object", function () {
    verifyMerge(ObjectUtils.INITIAL_VALUE, { a: 1 });
  });

  it("Object to INITIAL_VALUE should throw", function () {
    expect(() => ObjectUtils.merge({ a: 1 }, ObjectUtils.INITIAL_VALUE)).toThrow('MERGE_ERROR');
  });

  // Object to Object
  it("Object to Object: New property", function () {
    verifyMerge({ a: 1 }, { c: 2 }, true);
  });

  it("Object to Object: Same property", function () {
    verifyMerge({ a: 1 }, { a: 3 }, true);
  });

  it("Object to Object: prop in a not in b", function () {
    verifyMerge({ a: 1, b: 2 }, { b: 3 }, true);
  });

  it("Deep Object to Array", function () {
    verifyMerge({ a: 1, b: { a: 2 } }, { a: 1, b: [1, 2] }, true);
  });

  it("Object with no change", function () {
    verifyMerge({ a: 1, b: 1 }, { a: 1, b:1 }, true);
  });

  // Cyclic Object
  it("Cyclic Object should throw", function () {
    var a = { b: 1 };
    var b = { b: 3 };
    a.a = a;
    b.a = b;
    expect(() => ObjectUtils.merge(a, b)).toThrow();
  });
});

let _oldGetOwnPropertySymbols;
describe("Object Utilities: without symbols for IE11", function () {
  beforeEach(() => {
    _oldGetOwnPropertySymbols = Object.getOwnPropertySymbols;
    delete Object.getOwnPropertySymbols;
  });

  it("Object to Object merge", function () {
    verifyMerge({ a: 1 }, { c: 2 }, true);
  });

  afterEach(() => {
    Object.getOwnPropertySymbols = _oldGetOwnPropertySymbols;
  });
});

describe("Object Utilities: isEqual", function () {
  it("Primitive to Primitive", function () {
    expect(ObjectUtils.isEqual(1, 1)).toBe(true);
    expect(ObjectUtils.isEqual(1, 'a')).toBe(false);
  });

  it("Array to Array", function () {
    expect(ObjectUtils.isEqual([1, 2], [1, 2])).toBe(true);
    expect(ObjectUtils.isEqual([1, 2], [1, 3])).toBe(false);
  });

  it("Object to Object", function () {
    expect(ObjectUtils.isEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(ObjectUtils.isEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(ObjectUtils.isEqual({ a: 1 }, { b: 1 })).toBe(false);
  });

  it("Cross types", function () {
    expect(ObjectUtils.isEqual([1, 2], 1)).toBe(false);
    expect(ObjectUtils.isEqual(1, { a: 1 })).toBe(false);
    expect(ObjectUtils.isEqual([1, 2], { a: 1 })).toBe(false);
  });

  // Cyclic Object
  it("Cyclic Object should throw", function () {
    var a = { b: 1 };
    var b = { b: 1 };
    a.a = a;
    b.a = b;
    expect(() => ObjectUtils.isEqual(a, b)).toThrow();
  });
});

describe("Object Utilities: clone", function () {
  it("Primitive", function () {
    expect(ObjectUtils.clone(1)).toBe(1);
    expect(ObjectUtils.clone(ObjectUtils.INITIAL_VALUE)).toBe(ObjectUtils.INITIAL_VALUE);
  });

  it("Array", function () {
    expect(ObjectUtils.clone([1, 2])).toEqual([1, 2]);
    expect(ObjectUtils.clone([1, [1, 2]])).toEqual([1, [1, 2]]);
  });

  it("Object", function () {
    expect(ObjectUtils.clone({ a: 1 })).toEqual({ a: 1 });
    expect(ObjectUtils.clone({ a: 1, b: { a: 1 } })).toEqual({ a: 1, b: { a: 1 } });
  });

  // Cyclic Object
  it("Cyclic Object should throw", function () {
    var a = { b: 1 };
    a.a = a;
    expect(() => ObjectUtils.clone(a)).toThrow();
  });
});

describe("Object Utilities: freeze", function () {
  it("Primitive", function () {
    expect(ObjectUtils.freeze(1)).toBe(1);
    expect(ObjectUtils.freeze(ObjectUtils.INITIAL_VALUE)).toBe(ObjectUtils.INITIAL_VALUE);
  });

  it("Array", function () {
    var a = ObjectUtils.freeze([1, [1, 2]]);
    expect(() => a[0] = 2).toThrow();
    expect(() => a.shift()).toThrow();
    expect(() => a.splice(1, 1)).toThrow();
  });

  it("Object", function () {
    var a = ObjectUtils.freeze({ a: 1, b: { a: 1 } });
    expect(() => a.a = 2).toThrow();
    expect(() => delete a.a).toThrow();
    expect(() => Object.assign(a, { a: 2 })).toThrow();
  });

  // Cyclic Object
  it("Cyclic Object should throw", function () {
    var a = { b: 1 };
    a.a = a;
    expect(() => ObjectUtils.freeze(a)).toThrow();
  });
});
