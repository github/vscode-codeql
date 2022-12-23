// Test that computeDefaultStrings is set correctly.

newtype TUnit = MkUnit()

class Unit extends TUnit {
  Unit() { this = MkUnit() }

  string toString() { none() }
}

from Unit u
select u
