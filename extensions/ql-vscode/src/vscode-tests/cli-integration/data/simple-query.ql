predicate edges(int i, int j) {
  i = 1 and j = 2 or i = 2 and j = 3
}


from int i, int j
where edges(i, j)
select i, j
