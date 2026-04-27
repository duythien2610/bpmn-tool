@echo off

pushd %~dp0
pushd c8run-8.9.0
.\c8run.exe start --startup-url="https://developers.camunda.com/quick-start?c8run_start=success"
popd
popd
