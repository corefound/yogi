; ModuleID = 'main_io'
source_filename = "main.io"
target triple = "arm64-apple-darwin25.3.0"

@_yogi_main_io_retryCount = internal global double 0.000000e+00
@_yogi_main_io_externalPayload = internal global ptr null
@_yogi_main_io_status = internal global ptr null
@_yogi_main_io_cachedOwner = internal global ptr null
@_yogi_main_io_owner = internal global ptr null
@_yogi_main_io_releaseName = internal global ptr null
@_yogi_main_io_auditTarget = internal global ptr null
@_yogi_main_io_targetRetries = internal global ptr null
@_yogi_main_io_auditOwner = internal global ptr null
@_yogi_main_io_name = internal global ptr null
@_yogi_main_io_priority = internal global double 0.000000e+00
@_yogi_main_io_hasRetries = internal global i1 false
@_yogi_main_io_canDeploy = internal global i1 false
@0 = private unnamed_addr constant [9 x i8] c"platform\00", align 1
@1 = private unnamed_addr constant [13 x i8] c"release-team\00", align 1
@_yogi_scoring_io_hasEnoughScore = external global i1
@2 = private unnamed_addr constant [7 x i8] c"stable\00", align 1
@3 = private unnamed_addr constant [10 x i8] c"candidate\00", align 1
@4 = private unnamed_addr constant [9 x i8] c"fallback\00", align 1
@_yogi_config_io_maxRetries = external global double
@5 = private unnamed_addr constant [18 x i8] c"release-candidate\00", align 1
@6 = private unnamed_addr constant [16 x i8] c"automated-check\00", align 1
@7 = private unnamed_addr constant [14 x i8] c"manual-review\00", align 1

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
  %yogi_any_from_number.call = call ptr @yogi_any_from_number(double 1.000000e+01)
  store ptr %yogi_any_from_number.call, ptr @_yogi_main_io_externalPayload, align 8
  store ptr null, ptr @_yogi_main_io_status, align 8
  store ptr null, ptr @_yogi_main_io_cachedOwner, align 8
  store ptr @0, ptr @_yogi_main_io_owner, align 8
  store ptr @1, ptr @_yogi_main_io_cachedOwner, align 8
  %hasEnoughScore.load = load i1, ptr @_yogi_scoring_io_hasEnoughScore, align 1
  br i1 %hasEnoughScore.load, label %cond.then, label %cond.else

cond.then:                                        ; preds = %entry
  br label %cond.end

cond.else:                                        ; preds = %entry
  br label %cond.end

cond.end:                                         ; preds = %cond.else, %cond.then
  %condtmp = phi ptr [ @2, %cond.then ], [ @3, %cond.else ]
  store ptr %condtmp, ptr @_yogi_main_io_releaseName, align 8
  store ptr null, ptr @_yogi_main_io_auditTarget, align 8
  store ptr null, ptr @_yogi_main_io_targetRetries, align 8
  %owner.load = load ptr, ptr @_yogi_main_io_owner, align 8
  store ptr %owner.load, ptr @_yogi_main_io_auditOwner, align 8
  store ptr @4, ptr @_yogi_main_io_name, align 8
  store double 1.000000e+00, ptr @_yogi_main_io_priority, align 8
  %retryCount.load = load double, ptr @_yogi_main_io_retryCount, align 8
  %maxRetries.load = load double, ptr @_yogi_config_io_maxRetries, align 8
  %cmptmp = fcmp olt double %retryCount.load, %maxRetries.load
  store i1 %cmptmp, ptr @_yogi_main_io_hasRetries, align 1
  %hasEnoughScore.load1 = load i1, ptr @_yogi_scoring_io_hasEnoughScore, align 1
  %hasRetries.load = load i1, ptr @_yogi_main_io_hasRetries, align 1
  %andtmp = and i1 %hasEnoughScore.load1, %hasRetries.load
  store i1 %andtmp, ptr @_yogi_main_io_canDeploy, align 1
  %canDeploy.load = load i1, ptr @_yogi_main_io_canDeploy, align 1
  br i1 %canDeploy.load, label %if.then, label %if.end

if.then:                                          ; preds = %cond.end
  store ptr @5, ptr @_yogi_main_io_status, align 8
  %retryCount.load2 = load double, ptr @_yogi_main_io_retryCount, align 8
  %priority.load = load double, ptr @_yogi_main_io_priority, align 8
  %addtmp = fadd double %retryCount.load2, %priority.load
  store double %addtmp, ptr @_yogi_main_io_retryCount, align 8
  store ptr @6, ptr %auditLabel, align 8
  %auditLabel.load = load ptr, ptr %auditLabel, align 8
  %eqtmp = icmp eq ptr %auditLabel.load, null
  %netmp = xor i1 %eqtmp, true
  br i1 %netmp, label %if.then3, label %if.end4

if.end:                                           ; preds = %if.end4, %cond.end
  %status.load = load ptr, ptr @_yogi_main_io_status, align 8
  %eqtmp5 = icmp eq ptr %status.load, null
  br i1 %eqtmp5, label %if.then6, label %if.end7

if.then3:                                         ; preds = %if.then
  store i1 true, ptr %auditPassed, align 1
  br label %if.end4

if.end4:                                          ; preds = %if.then3, %if.then
  br label %if.end

if.then6:                                         ; preds = %if.end
  store ptr @7, ptr @_yogi_main_io_status, align 8
  %retryCount.load8 = load double, ptr @_yogi_main_io_retryCount, align 8
  %addtmp9 = fadd double %retryCount.load8, 1.000000e+00
  store double %addtmp9, ptr @_yogi_main_io_retryCount, align 8
  br label %if.end7

if.end7:                                          ; preds = %if.then6, %if.end
  ret void
}

declare ptr @yogi_any_from_number(double)

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
