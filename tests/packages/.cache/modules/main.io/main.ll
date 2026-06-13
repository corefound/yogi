; ModuleID = 'main_io'
source_filename = "main.io"
target triple = "arm64-apple-darwin25.3.0"

@_yogi_main_io_retryCount = internal global double 0.000000e+00
@_yogi_main_io_externalPayload = internal global ptr null
@_yogi_main_io_status = internal global ptr null
@_yogi_main_io_hasRetries = internal global i1 false
@_yogi_main_io_canDeploy = internal global i1 false
@_yogi_config_io_maxRetries = external global double
@_yogi_scoring_io_hasEnoughScore = external global i1
@0 = private unnamed_addr constant [18 x i8] c"release-candidate\00", align 1
@1 = private unnamed_addr constant [16 x i8] c"automated-check\00", align 1
@2 = private unnamed_addr constant [14 x i8] c"manual-review\00", align 1

define internal double @_yogi_fn_main_io_createAuditWeight(double %input, double %weight) {
entry:
  %total = alloca double, align 8
  %weight2 = alloca double, align 8
  %input1 = alloca double, align 8
  store double %input, ptr %input1, align 8
  store double %weight, ptr %weight2, align 8
  %input.load = load double, ptr %input1, align 8
  %weight.load = load double, ptr %weight2, align 8
  %addtmp = fadd double %input.load, %weight.load
  store double %addtmp, ptr %total, align 8
  %total.load = load double, ptr %total, align 8
  ret double %total.load
}

define void @_yogi_module_init_main_io() {
entry:
  %auditPassed = alloca i1, align 1
  %auditLabel = alloca ptr, align 8
  store double 0.000000e+00, ptr @_yogi_main_io_retryCount, align 8
  store ptr null, ptr @_yogi_main_io_externalPayload, align 8
  store ptr null, ptr @_yogi_main_io_status, align 8
  %retryCount.load = load double, ptr @_yogi_main_io_retryCount, align 8
  %maxRetries.load = load double, ptr @_yogi_config_io_maxRetries, align 8
  %cmptmp = fcmp olt double %retryCount.load, %maxRetries.load
  store i1 %cmptmp, ptr @_yogi_main_io_hasRetries, align 1
  %hasEnoughScore.load = load i1, ptr @_yogi_scoring_io_hasEnoughScore, align 1
  %hasRetries.load = load i1, ptr @_yogi_main_io_hasRetries, align 1
  %andtmp = and i1 %hasEnoughScore.load, %hasRetries.load
  store i1 %andtmp, ptr @_yogi_main_io_canDeploy, align 1
  %canDeploy.load = load i1, ptr @_yogi_main_io_canDeploy, align 1
  br i1 %canDeploy.load, label %if.then, label %if.end

if.then:                                          ; preds = %entry
  store ptr @0, ptr @_yogi_main_io_status, align 8
  %retryCount.load1 = load double, ptr @_yogi_main_io_retryCount, align 8
  %addtmp = fadd double %retryCount.load1, 1.000000e+00
  store double %addtmp, ptr @_yogi_main_io_retryCount, align 8
  store ptr @1, ptr %auditLabel, align 8
  %auditLabel.load = load ptr, ptr %auditLabel, align 8
  %eqtmp = icmp eq ptr %auditLabel.load, null
  %netmp = xor i1 %eqtmp, true
  br i1 %netmp, label %if.then2, label %if.end3

if.end:                                           ; preds = %if.end3, %entry
  %status.load = load ptr, ptr @_yogi_main_io_status, align 8
  %eqtmp4 = icmp eq ptr %status.load, null
  br i1 %eqtmp4, label %if.then5, label %if.end6

if.then2:                                         ; preds = %if.then
  store i1 true, ptr %auditPassed, align 1
  br label %if.end3

if.end3:                                          ; preds = %if.then2, %if.then
  br label %if.end

if.then5:                                         ; preds = %if.end
  store ptr @2, ptr @_yogi_main_io_status, align 8
  %retryCount.load7 = load double, ptr @_yogi_main_io_retryCount, align 8
  %addtmp8 = fadd double %retryCount.load7, 1.000000e+00
  store double %addtmp8, ptr @_yogi_main_io_retryCount, align 8
  br label %if.end6

if.end6:                                          ; preds = %if.then5, %if.end
  ret void
}

define i32 @main() {
entry:
  call void @_yogi_module_init_status_io()
  call void @_yogi_module_init_config_io()
  call void @_yogi_module_init_metrics_io()
  call void @_yogi_module_init_scoring_io()
  call void @_yogi_module_init_main_io()
  ret i32 0
}

declare void @_yogi_module_init_status_io()

declare void @_yogi_module_init_config_io()

declare void @_yogi_module_init_metrics_io()

declare void @_yogi_module_init_scoring_io()
