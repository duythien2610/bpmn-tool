@echo off

pushd %~dp0
pushd c8run-8.9.0
.\c8run.exe stop
popd
popd
