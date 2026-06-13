; ModuleID = 'config_io'
source_filename = "config.io"
target triple = "arm64-apple-darwin25.3.0"

@_yogi_config_io_maxScore = global double 0.000000e+00
@_yogi_config_io_minDeployScore = global double 0.000000e+00
@_yogi_config_io_maxRetries = global double 0.000000e+00

define void @_yogi_module_init_config_io() {
entry:
  store double 1.000000e+02, ptr @_yogi_config_io_maxScore, align 8
  store double 7.000000e+01, ptr @_yogi_config_io_minDeployScore, align 8
  store double 3.000000e+00, ptr @_yogi_config_io_maxRetries, align 8
  ret void
}
