import QuickEvalLib

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
