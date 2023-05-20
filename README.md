# kinfolk

Atoms and selectors for React.

## Why?

Kinfolk will help:

- share state across wide parts of the application
- memoize computed state derived values

Algo:

atom

atom->selector1
atom->selector2
atom->selector3

selector2->selector4
selector3->selector5

atom changes
mark entire tree as "dirty"
call all listeners for just this tree!
it will recompute value of any dependency
but only if it's marked dirty
and if all dependencies return same value by reference...
we skip recomputing and mark as clean
and return
and react takes care of not re-rendering if snapshot did not change
