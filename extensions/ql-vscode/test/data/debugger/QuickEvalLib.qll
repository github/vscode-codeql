newtype TNumber = MkNumber(int n) {
    n in [0..20]
}

abstract class InterestingNumber extends TNumber
{
    int value;

    InterestingNumber() {
        this = MkNumber(value)
    }

    string toString() {
        result = value.toString()
    }

    final int getValue() {
        result = value
    }
}
