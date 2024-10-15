import QuickEvalLib

class InterestingBigInt instanceof InterestingNumber
{
    QlBuiltins::BigInt getBigIntValue() {
        result = super.getValue().toBigInt().pow(10)
    }

    string toString() {
        result = super.toString()
    }
}

class PrimeNumber extends InterestingNumber {
    PrimeNumber() {
        exists(int n | this = MkNumber(n) |
            n in [
                2,
                3,
                5,
                7,
                11,
                13,
                17,
                19
            ])
    }
}

from InterestingNumber n
select n.toString()
