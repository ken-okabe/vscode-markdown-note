const randHistory = [];

const getRandomInt = (min, max) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min);
    //The maximum is exclusive and the minimum is inclusive
};

const getRand = (): string => {
    const value = getRandomInt(0, 1000000000).toString();
    return randHistory.includes(value)
        ? getRand()
        : (() => {
            randHistory[randHistory.length] = value;
            return value;
        })();
};

export { getRand }