# log-insights/core/log-processors

This directory contains the log top-level log processors.
They will generally read and write files on disk with their exported `process` function, possibly making use of on-disk caches to speed up processing.

The files might expose additional functions for testing purposes, as well as in-memory variations of the top-level `process` function.
