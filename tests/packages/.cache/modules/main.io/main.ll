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
@_yogi_main_io_retrySlots = internal global ptr null
@_yogi_main_io_selectedSlot = internal global double 0.000000e+00
@_yogi_main_io_hasRetries = internal global i1 false
@_yogi_main_io_canDeploy = internal global i1 false
@0 = private unnamed_addr constant [8 x i8] c"main_io\00", align 1
@1 = private unnamed_addr constant [26 x i8] c"main.io:createAuditWeight\00", align 1
@2 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@3 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@4 = private unnamed_addr constant [8 x i8] c"main_io\00", align 1
@5 = private unnamed_addr constant [13 x i8] c"$module.init\00", align 1
@6 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@7 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@8 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@9 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@10 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@11 = private unnamed_addr constant [9 x i8] c"platform\00", align 1
@12 = private unnamed_addr constant [13 x i8] c"release-team\00", align 1
@13 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@_yogi_scoring_io_hasEnoughScore = external global i1
@14 = private unnamed_addr constant [7 x i8] c"stable\00", align 1
@15 = private unnamed_addr constant [10 x i8] c"candidate\00", align 1
@16 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@17 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@18 = private unnamed_addr constant [5 x i8] c"name\00", align 1
@19 = private unnamed_addr constant [5 x i8] c"name\00", align 1
@20 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@21 = private unnamed_addr constant [8 x i8] c"retries\00", align 1
@22 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@23 = private unnamed_addr constant [5 x i8] c"name\00", align 1
@24 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@25 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@26 = private unnamed_addr constant [5 x i8] c"name\00", align 1
@27 = private unnamed_addr constant [9 x i8] c"fallback\00", align 1
@28 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@29 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@30 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@31 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@32 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@33 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@_yogi_config_io_maxRetries = external global double
@34 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@35 = private unnamed_addr constant [18 x i8] c"release-candidate\00", align 1
@36 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@37 = private unnamed_addr constant [16 x i8] c"automated-check\00", align 1
@38 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@39 = private unnamed_addr constant [14 x i8] c"manual-review\00", align 1
@40 = private unnamed_addr constant [8 x i8] c"main_io\00", align 1
@41 = private unnamed_addr constant [16 x i8] c"$module.cleanup\00", align 1
@42 = private unnamed_addr constant [8 x i8] c"main_io\00", align 1
@43 = private unnamed_addr constant [5 x i8] c"main\00", align 1

define internal double @_yogi_fn_main_io_createAuditWeight(double %input, double %weight) {
entry:
  %total = alloca double, align 8
  %weight2 = alloca double, align 8
  %input1 = alloca double, align 8
  call void @yogi_memory_push_context(ptr @0, ptr @1)
  store double %input, ptr %input1, align 8
  store double %weight, ptr %weight2, align 8
  call void @yogi_memory_push_source_location(ptr @2, i64 6, i64 9)
  %input.load = load double, ptr %input1, align 8
  %weight.load = load double, ptr %weight2, align 8
  %addtmp = fadd double %input.load, %weight.load
  call void @yogi_memory_pop_source_location()
  store double %addtmp, ptr %total, align 8
  call void @yogi_memory_push_source_location(ptr @3, i64 7, i64 5)
  %total.load = load double, ptr %total, align 8
  call void @yogi_memory_pop_source_location()
  call void @yogi_memory_pop_context()
  ret double %total.load
}

declare void @yogi_memory_push_context(ptr, ptr)

declare void @yogi_memory_push_source_location(ptr, i64, i64)

declare void @yogi_memory_pop_source_location()

declare void @yogi_memory_pop_context()

define void @_yogi_module_init_main_io() {
entry:
  %auditPassed = alloca i1, align 1
  %auditLabel = alloca ptr, align 8
  call void @yogi_memory_push_context(ptr @4, ptr @5)
  call void @yogi_memory_push_source_location(ptr @6, i64 10, i64 5)
  call void @yogi_memory_pop_source_location()
  store double 0.000000e+00, ptr @_yogi_main_io_retryCount, align 8
  call void @yogi_memory_push_source_location(ptr @7, i64 11, i64 5)
  %yogi_any_from_number.call = call ptr @yogi_any_from_number(double 1.000000e+01)
  call void @yogi_memory_pop_source_location()
  store ptr %yogi_any_from_number.call, ptr @_yogi_main_io_externalPayload, align 8
  call void @yogi_memory_push_source_location(ptr @8, i64 12, i64 5)
  call void @yogi_memory_pop_source_location()
  store ptr null, ptr @_yogi_main_io_status, align 8
  call void @yogi_memory_push_source_location(ptr @9, i64 13, i64 5)
  call void @yogi_memory_pop_source_location()
  store ptr null, ptr @_yogi_main_io_cachedOwner, align 8
  call void @yogi_memory_push_source_location(ptr @10, i64 14, i64 5)
  call void @yogi_memory_pop_source_location()
  store ptr @11, ptr @_yogi_main_io_owner, align 8
  store ptr @12, ptr @_yogi_main_io_cachedOwner, align 8
  call void @yogi_memory_push_source_location(ptr @13, i64 17, i64 5)
  %hasEnoughScore.load = load i1, ptr @_yogi_scoring_io_hasEnoughScore, align 1
  br i1 %hasEnoughScore.load, label %cond.then, label %cond.else

cond.then:                                        ; preds = %entry
  br label %cond.end

cond.else:                                        ; preds = %entry
  br label %cond.end

cond.end:                                         ; preds = %cond.else, %cond.then
  %condtmp = phi ptr [ @14, %cond.then ], [ @15, %cond.else ]
  call void @yogi_memory_pop_source_location()
  store ptr %condtmp, ptr @_yogi_main_io_releaseName, align 8
  call void @yogi_memory_push_source_location(ptr @16, i64 18, i64 5)
  call void @yogi_memory_push_source_location(ptr @17, i64 18, i64 55)
  %yogi_object_create.call = call ptr @yogi_object_create()
  %owner.load = load ptr, ptr @_yogi_main_io_owner, align 8
  %yogi_any_from_string.call = call ptr @yogi_any_from_string(ptr %owner.load)
  call void @yogi_object_set(ptr %yogi_object_create.call, ptr @18, ptr %yogi_any_from_string.call)
  call void @yogi_memory_pop_source_location()
  call void @yogi_memory_pop_source_location()
  store ptr %yogi_object_create.call, ptr @_yogi_main_io_auditTarget, align 8
  %releaseName.load = load ptr, ptr @_yogi_main_io_releaseName, align 8
  %yogi_any_from_string.call1 = call ptr @yogi_any_from_string(ptr %releaseName.load)
  %auditTarget.load = load ptr, ptr @_yogi_main_io_auditTarget, align 8
  call void @yogi_object_set(ptr %auditTarget.load, ptr @19, ptr %yogi_any_from_string.call1)
  call void @yogi_memory_push_source_location(ptr @20, i64 20, i64 5)
  %auditTarget.load2 = load ptr, ptr @_yogi_main_io_auditTarget, align 8
  %yogi_object_get.call = call ptr @yogi_object_get(ptr %auditTarget.load2, ptr @21)
  call void @yogi_memory_pop_source_location()
  store ptr %yogi_object_get.call, ptr @_yogi_main_io_targetRetries, align 8
  call void @yogi_memory_push_source_location(ptr @22, i64 21, i64 5)
  %auditTarget.load3 = load ptr, ptr @_yogi_main_io_auditTarget, align 8
  %yogi_object_get.call4 = call ptr @yogi_object_get(ptr %auditTarget.load3, ptr @23)
  %yogi_any_to_string.call = call ptr @yogi_any_to_string(ptr %yogi_object_get.call4)
  call void @yogi_memory_pop_source_location()
  store ptr %yogi_any_to_string.call, ptr @_yogi_main_io_auditOwner, align 8
  call void @yogi_memory_push_source_location(ptr @24, i64 23, i64 7)
  call void @yogi_memory_push_source_location(ptr @25, i64 23, i64 48)
  %yogi_object_create.call5 = call ptr @yogi_object_create()
  call void @yogi_memory_pop_source_location()
  %yogi_object_get.call6 = call ptr @yogi_object_get(ptr %yogi_object_create.call5, ptr @26)
  %yogi_any_is_nullish.call = call i1 @yogi_any_is_nullish(ptr %yogi_object_get.call6)
  %nullish.has_value = xor i1 %yogi_any_is_nullish.call, true
  br i1 %nullish.has_value, label %nullish.present, label %nullish.fallback

nullish.present:                                  ; preds = %cond.end
  %yogi_any_to_string.call7 = call ptr @yogi_any_to_string(ptr %yogi_object_get.call6)
  br label %nullish.end

nullish.fallback:                                 ; preds = %cond.end
  br label %nullish.end

nullish.end:                                      ; preds = %nullish.fallback, %nullish.present
  %nullishtmp = phi ptr [ %yogi_any_to_string.call7, %nullish.present ], [ @27, %nullish.fallback ]
  call void @yogi_memory_pop_source_location()
  store ptr %nullishtmp, ptr @_yogi_main_io_name, align 8
  call void @yogi_memory_push_source_location(ptr @28, i64 24, i64 6)
  call void @yogi_memory_push_source_location(ptr @29, i64 24, i64 44)
  %yogi_array_create.call = call ptr @yogi_array_create(i64 1)
  %yogi_any_undefined.call = call ptr @yogi_any_undefined()
  call void @yogi_array_set(ptr %yogi_array_create.call, i64 0, ptr %yogi_any_undefined.call)
  call void @yogi_memory_pop_source_location()
  %yogi_array_get.call = call ptr @yogi_array_get(ptr %yogi_array_create.call, i64 0)
  %yogi_any_is_nullish.call8 = call i1 @yogi_any_is_nullish(ptr %yogi_array_get.call)
  %nullish.has_value9 = xor i1 %yogi_any_is_nullish.call8, true
  br i1 %nullish.has_value9, label %nullish.present10, label %nullish.fallback11

nullish.present10:                                ; preds = %nullish.end
  %yogi_any_to_number.call = call double @yogi_any_to_number(ptr %yogi_array_get.call)
  br label %nullish.end12

nullish.fallback11:                               ; preds = %nullish.end
  br label %nullish.end12

nullish.end12:                                    ; preds = %nullish.fallback11, %nullish.present10
  %nullishtmp13 = phi double [ %yogi_any_to_number.call, %nullish.present10 ], [ 1.000000e+00, %nullish.fallback11 ]
  call void @yogi_memory_pop_source_location()
  store double %nullishtmp13, ptr @_yogi_main_io_priority, align 8
  call void @yogi_memory_push_source_location(ptr @30, i64 25, i64 5)
  call void @yogi_memory_push_source_location(ptr @31, i64 25, i64 28)
  %yogi_array_create.call14 = call ptr @yogi_array_create(i64 3)
  %yogi_any_from_number.call15 = call ptr @yogi_any_from_number(double 0.000000e+00)
  call void @yogi_array_set(ptr %yogi_array_create.call14, i64 0, ptr %yogi_any_from_number.call15)
  %yogi_any_from_number.call16 = call ptr @yogi_any_from_number(double 1.000000e+00)
  call void @yogi_array_set(ptr %yogi_array_create.call14, i64 1, ptr %yogi_any_from_number.call16)
  %yogi_any_from_number.call17 = call ptr @yogi_any_from_number(double 2.000000e+00)
  call void @yogi_array_set(ptr %yogi_array_create.call14, i64 2, ptr %yogi_any_from_number.call17)
  call void @yogi_memory_pop_source_location()
  call void @yogi_memory_pop_source_location()
  store ptr %yogi_array_create.call14, ptr @_yogi_main_io_retrySlots, align 8
  %priority.load = load double, ptr @_yogi_main_io_priority, align 8
  %yogi_any_from_number.call18 = call ptr @yogi_any_from_number(double %priority.load)
  %retrySlots.load = load ptr, ptr @_yogi_main_io_retrySlots, align 8
  call void @yogi_array_set(ptr %retrySlots.load, i64 1, ptr %yogi_any_from_number.call18)
  call void @yogi_memory_push_source_location(ptr @32, i64 27, i64 5)
  %retrySlots.load19 = load ptr, ptr @_yogi_main_io_retrySlots, align 8
  %yogi_array_get.call20 = call ptr @yogi_array_get(ptr %retrySlots.load19, i64 1)
  %yogi_any_to_number.call21 = call double @yogi_any_to_number(ptr %yogi_array_get.call20)
  call void @yogi_memory_pop_source_location()
  store double %yogi_any_to_number.call21, ptr @_yogi_main_io_selectedSlot, align 8
  call void @yogi_memory_push_source_location(ptr @33, i64 29, i64 5)
  %retryCount.load = load double, ptr @_yogi_main_io_retryCount, align 8
  %maxRetries.load = load double, ptr @_yogi_config_io_maxRetries, align 8
  %cmptmp = fcmp olt double %retryCount.load, %maxRetries.load
  call void @yogi_memory_pop_source_location()
  store i1 %cmptmp, ptr @_yogi_main_io_hasRetries, align 1
  call void @yogi_memory_push_source_location(ptr @34, i64 30, i64 5)
  %hasEnoughScore.load22 = load i1, ptr @_yogi_scoring_io_hasEnoughScore, align 1
  %hasRetries.load = load i1, ptr @_yogi_main_io_hasRetries, align 1
  %andtmp = and i1 %hasEnoughScore.load22, %hasRetries.load
  call void @yogi_memory_pop_source_location()
  store i1 %andtmp, ptr @_yogi_main_io_canDeploy, align 1
  %canDeploy.load = load i1, ptr @_yogi_main_io_canDeploy, align 1
  br i1 %canDeploy.load, label %if.then, label %if.end

if.then:                                          ; preds = %nullish.end12
  store ptr @35, ptr @_yogi_main_io_status, align 8
  %retryCount.load23 = load double, ptr @_yogi_main_io_retryCount, align 8
  %priority.load24 = load double, ptr @_yogi_main_io_priority, align 8
  %addtmp = fadd double %retryCount.load23, %priority.load24
  store double %addtmp, ptr @_yogi_main_io_retryCount, align 8
  call void @yogi_memory_push_source_location(ptr @36, i64 36, i64 9)
  call void @yogi_memory_pop_source_location()
  store ptr @37, ptr %auditLabel, align 8
  %auditLabel.load = load ptr, ptr %auditLabel, align 8
  %eqtmp = icmp eq ptr %auditLabel.load, null
  %netmp = xor i1 %eqtmp, true
  br i1 %netmp, label %if.then25, label %if.end26

if.end:                                           ; preds = %if.end26, %nullish.end12
  %status.load = load ptr, ptr @_yogi_main_io_status, align 8
  %eqtmp27 = icmp eq ptr %status.load, null
  br i1 %eqtmp27, label %if.then28, label %if.end29

if.then25:                                        ; preds = %if.then
  call void @yogi_memory_push_source_location(ptr @38, i64 39, i64 13)
  call void @yogi_memory_pop_source_location()
  store i1 true, ptr %auditPassed, align 1
  br label %if.end26

if.end26:                                         ; preds = %if.then25, %if.then
  br label %if.end

if.then28:                                        ; preds = %if.end
  store ptr @39, ptr @_yogi_main_io_status, align 8
  %retryCount.load30 = load double, ptr @_yogi_main_io_retryCount, align 8
  %addtmp31 = fadd double %retryCount.load30, 1.000000e+00
  store double %addtmp31, ptr @_yogi_main_io_retryCount, align 8
  br label %if.end29

if.end29:                                         ; preds = %if.then28, %if.end
  call void @yogi_memory_pop_context()
  ret void
}

declare ptr @yogi_any_from_number(double)

declare ptr @yogi_object_create()

declare ptr @yogi_any_from_string(ptr)

declare void @yogi_object_set(ptr, ptr, ptr)

declare ptr @yogi_object_get(ptr, ptr)

declare ptr @yogi_any_to_string(ptr)

declare i1 @yogi_any_is_nullish(ptr)

declare ptr @yogi_array_create(i64)

declare ptr @yogi_any_undefined()

declare void @yogi_array_set(ptr, i64, ptr)

declare ptr @yogi_array_get(ptr, i64)

declare double @yogi_any_to_number(ptr)

define void @_yogi_module_cleanup_main_io() {
entry:
  call void @yogi_memory_push_context(ptr @40, ptr @41)
  %0 = load double, ptr @_yogi_main_io_retryCount, align 8
  store double 0.000000e+00, ptr @_yogi_main_io_retryCount, align 8
  %1 = load ptr, ptr @_yogi_main_io_externalPayload, align 8
  store ptr null, ptr @_yogi_main_io_externalPayload, align 8
  %2 = load ptr, ptr @_yogi_main_io_status, align 8
  store ptr null, ptr @_yogi_main_io_status, align 8
  %3 = load ptr, ptr @_yogi_main_io_cachedOwner, align 8
  store ptr null, ptr @_yogi_main_io_cachedOwner, align 8
  %4 = load ptr, ptr @_yogi_main_io_owner, align 8
  store ptr null, ptr @_yogi_main_io_owner, align 8
  %5 = load ptr, ptr @_yogi_main_io_releaseName, align 8
  store ptr null, ptr @_yogi_main_io_releaseName, align 8
  %6 = load ptr, ptr @_yogi_main_io_auditTarget, align 8
  call void @yogi_object_destroy(ptr %6)
  store ptr null, ptr @_yogi_main_io_auditTarget, align 8
  %7 = load ptr, ptr @_yogi_main_io_targetRetries, align 8
  store ptr null, ptr @_yogi_main_io_targetRetries, align 8
  %8 = load ptr, ptr @_yogi_main_io_auditOwner, align 8
  store ptr null, ptr @_yogi_main_io_auditOwner, align 8
  %9 = load ptr, ptr @_yogi_main_io_name, align 8
  store ptr null, ptr @_yogi_main_io_name, align 8
  %10 = load double, ptr @_yogi_main_io_priority, align 8
  store double 0.000000e+00, ptr @_yogi_main_io_priority, align 8
  %11 = load ptr, ptr @_yogi_main_io_retrySlots, align 8
  call void @yogi_array_destroy(ptr %11)
  store ptr null, ptr @_yogi_main_io_retrySlots, align 8
  %12 = load double, ptr @_yogi_main_io_selectedSlot, align 8
  store double 0.000000e+00, ptr @_yogi_main_io_selectedSlot, align 8
  %13 = load i1, ptr @_yogi_main_io_hasRetries, align 1
  store i1 false, ptr @_yogi_main_io_hasRetries, align 1
  %14 = load i1, ptr @_yogi_main_io_canDeploy, align 1
  store i1 false, ptr @_yogi_main_io_canDeploy, align 1
  call void @yogi_memory_pop_context()
  ret void
}

declare void @yogi_object_destroy(ptr)

declare void @yogi_array_destroy(ptr)

define i32 @main() {
entry:
  call void @yogi_memory_push_context(ptr @42, ptr @43)
  call void @_yogi_module_init_status_io()
  call void @_yogi_module_init_config_io()
  call void @_yogi_module_init_metrics_io()
  call void @_yogi_module_init_scoring_io()
  call void @_yogi_module_init_main_io()
  call void @_yogi_module_cleanup_main_io()
  call void @_yogi_module_cleanup_scoring_io()
  call void @_yogi_module_cleanup_metrics_io()
  call void @_yogi_module_cleanup_config_io()
  call void @_yogi_module_cleanup_status_io()
  call void @yogi_memory_pop_context()
  ret i32 0
}

declare void @_yogi_module_init_status_io()

declare void @_yogi_module_init_config_io()

declare void @_yogi_module_init_metrics_io()

declare void @_yogi_module_init_scoring_io()

declare void @_yogi_module_cleanup_scoring_io()

declare void @_yogi_module_cleanup_metrics_io()

declare void @_yogi_module_cleanup_config_io()

declare void @_yogi_module_cleanup_status_io()
