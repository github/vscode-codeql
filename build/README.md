GitHub Actions Build directory
===

The point of this directory is to allow us to do a local installation *of* the rush
tool, since 
 - installing globally is not permitted on github actions
 - installing locally in the root directory of the repo creates `node_modules` there,
   and rush itself gives error messages since it thinks `node_modules` is not supposed 
   to exist, since rush is supposed to be managing subproject dependencies.

Running rush from a subdirectory searches parent directories for `rush.json`
and does the build starting from that file's location.
