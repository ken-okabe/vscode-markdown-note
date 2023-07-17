
type Reactive<A> = {
    lastVal: A; //mutable
    lastFns: Array<(a: A) => void>; //mutable
};

type R =
    <A> (a: A) => Reactive<A>;
let R: R =
    a => ({ lastVal: a, lastFns: [] });

type nextR =
    <A>(a: A) => (reactive: Reactive<A>) => Reactive<A>;
let nextR: nextR =
    a => reactive => {
        reactive.lastVal = a;
        reactive.lastFns.map((fn) => fn(a));
        return reactive;
    };

type _newFn = <A, B>
    (f: (a: A) => Reactive<B>) =>
    (reactiveB: Reactive<B>) => (a: A) => void;
let _newFn: _newFn =
    f => reactiveB =>
        a => {
            let b = (f)(a).lastVal;
            nextR(b)(reactiveB);
            return undefined;
        };

type flatMapR = <A, B>
    (f: (a: A) => Reactive<B>) =>
    (reactiveA: Reactive<A>) => Reactive<B>;
let flatMapR: flatMapR =
    f => reactiveA => {
        let reactiveB = f(reactiveA.lastVal);
        let newFn = _newFn(f)(reactiveB)
        reactiveA.lastFns = reactiveA.lastFns.concat([newFn]);
        return reactiveB;
    };

//----------------------------------------------
type compose =
    <A, B>(f: (a: A) => B) =>
        <C>(g: (b: B) => C) =>
            (a: A) => C;
let compose: compose =
    f => g =>
        a => g(f(a));

type monadic = <A, B>
    (f: (a: A) => B) =>
    (a: A) => Reactive<B>;
let monadic: monadic =
    f => compose(f)(R);

type mapR = <A, B>
    (f: (a: A) => B) =>
    (reactiveA: Reactive<A>) => Reactive<B>;
let mapR: mapR =
    f => flatMapR(monadic(f));

type logR =
    (a: unknown) => Reactive<void>
let logR: logR =
    a => R(console.log(a));

export { R, nextR, flatMapR, mapR, logR }
export type { Reactive }