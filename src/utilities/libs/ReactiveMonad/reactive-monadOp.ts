
type Reactive<A> = {
    lastVal: A, // mutable
    lastFns: Array<((a: A) => void)>, // mutable
} & operatorsR;

type operatorsR = {
    readonly flatMapR: <A, B>(
        this: Reactive<A>,
        f: (a: A) => Reactive<B>
    ) => Reactive<B>,
    readonly mapR: <A, B>(
        this: Reactive<A>,
        f: (a: A) => B
    ) => Reactive<B>,
    //-------------------------
    readonly nextR: <A>(
        this: Reactive<A>,
        a: A
    ) => Reactive<A>
};

let operatorsR: operatorsR = {
    flatMapR: function (this, f) {
        return flatMapR(f)(this);
    },
    mapR: function (this, f) {
        return mapR(f)(this);
    },
    //-------------------------
    nextR: function (this, a) {
        return nextR(a)(this);
    }
};

type R = <A> (a: A) => Reactive<A>;
let R: R = a =>
    Object.assign(
        {
            lastVal: a, // mutable
            lastFns: [],// mutable
        },
        operatorsR);

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

//--------------------------------------
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
let mapR: mapR = f => flatMapR(monadic(f));

type logR =
    (a: unknown) => Reactive<void>
let logR: logR =
    a => R(console.log(a));

//--------------------------------------

export { R, logR }
export type { Reactive }