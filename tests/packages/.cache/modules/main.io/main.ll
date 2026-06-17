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
@_yogi_main_io_totalScore = internal global double 0.000000e+00
@_yogi_main_io_thresholdResult = internal global double 0.000000e+00
@0 = private unnamed_addr constant [8 x i8] c"main_io\00", align 1
@1 = private unnamed_addr constant [26 x i8] c"main.io:createAuditWeight\00", align 1
@2 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@3 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@4 = private unnamed_addr constant [8 x i8] c"main_io\00", align 1
@5 = private unnamed_addr constant [21 x i8] c"main.io:computeScore\00", align 1
@6 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@7 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@8 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@9 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@10 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@11 = private unnamed_addr constant [7 x i8] c"length\00", align 1
@12 = private unnamed_addr constant [8 x i8] c"main_io\00", align 1
@13 = private unnamed_addr constant [22 x i8] c"main.io:findThreshold\00", align 1
@14 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@15 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@16 = private unnamed_addr constant [7 x i8] c"length\00", align 1
@17 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@18 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@19 = private unnamed_addr constant [8 x i8] c"main_io\00", align 1
@20 = private unnamed_addr constant [13 x i8] c"$module.init\00", align 1
@21 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@22 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@23 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@24 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@25 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@26 = private unnamed_addr constant [9 x i8] c"platform\00", align 1
@27 = private unnamed_addr constant [13 x i8] c"release-team\00", align 1
@28 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@_yogi_scoring_io_hasEnoughScore = external global i1
@29 = private unnamed_addr constant [7 x i8] c"stable\00", align 1
@30 = private unnamed_addr constant [10 x i8] c"candidate\00", align 1
@31 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@32 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@33 = private unnamed_addr constant [5 x i8] c"name\00", align 1
@34 = private unnamed_addr constant [5 x i8] c"name\00", align 1
@35 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@36 = private unnamed_addr constant [8 x i8] c"retries\00", align 1
@37 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@38 = private unnamed_addr constant [5 x i8] c"name\00", align 1
@39 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@40 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@41 = private unnamed_addr constant [5 x i8] c"name\00", align 1
@42 = private unnamed_addr constant [9 x i8] c"fallback\00", align 1
@43 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@44 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@45 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@46 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@47 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@48 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@_yogi_config_io_maxRetries = external global double
@49 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@50 = private unnamed_addr constant [18 x i8] c"release-candidate\00", align 1
@51 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@52 = private unnamed_addr constant [16 x i8] c"automated-check\00", align 1
@53 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@54 = private unnamed_addr constant [14 x i8] c"manual-review\00", align 1
@55 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@56 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@57 = private unnamed_addr constant [8 x i8] c"main.io\00", align 1
@58 = private unnamed_addr constant [8 x i8] c"main_io\00", align 1
@59 = private unnamed_addr constant [16 x i8] c"$module.cleanup\00", align 1
@60 = private unnamed_addr constant [8 x i8] c"main_io\00", align 1
@61 = private unnamed_addr constant [5 x i8] c"main\00", align 1

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

define internal double @_yogi_fn_main_io_computeScore() {
entry:
  %first = alloca ptr, align 8
  %last = alloca ptr, align 8
  %scores = alloca ptr, align 8
  call void @yogi_memory_push_context(ptr @4, ptr @5)
  call void @yogi_memory_push_source_location(ptr @6, i64 50, i64 9)
  call void @yogi_memory_push_source_location(ptr @7, i64 50, i64 28)
  %yogi_array_sizeof.call = call i64 @yogi_array_sizeof()
  %scores.array.storage = alloca i8, i64 %yogi_array_sizeof.call, align 1
  call void @yogi_array_init(ptr %scores.array.storage, i64 2)
  %yogi_any_from_number.call = call ptr @yogi_any_from_number(double 1.000000e+01)
  call void @yogi_array_set(ptr %scores.array.storage, i64 0, ptr %yogi_any_from_number.call)
  %yogi_any_from_number.call1 = call ptr @yogi_any_from_number(double 2.000000e+01)
  call void @yogi_array_set(ptr %scores.array.storage, i64 1, ptr %yogi_any_from_number.call1)
  call void @yogi_memory_pop_source_location()
  call void @yogi_memory_pop_source_location()
  store ptr %scores.array.storage, ptr %scores, align 8
  %scores.load = load ptr, ptr %scores, align 8
  %yogi_any_from_number.call2 = call ptr @yogi_any_from_number(double 3.000000e+01)
  %yogi_array_push.call = call i64 @yogi_array_push(ptr %scores.load, ptr %yogi_any_from_number.call2)
  %array.push.length = uitofp i64 %yogi_array_push.call to double
  call void @yogi_memory_push_source_location(ptr @8, i64 52, i64 9)
  %scores.load3 = load ptr, ptr %scores, align 8
  %yogi_array_pop.call = call ptr @yogi_array_pop(ptr %scores.load3)
  call void @yogi_memory_pop_source_location()
  store ptr %yogi_array_pop.call, ptr %last, align 8
  call void @yogi_memory_push_source_location(ptr @9, i64 53, i64 9)
  %scores.load4 = load ptr, ptr %scores, align 8
  %yogi_array_at.call = call ptr @yogi_array_at(ptr %scores.load4, i64 0)
  call void @yogi_memory_pop_source_location()
  store ptr %yogi_array_at.call, ptr %first, align 8
  call void @yogi_memory_push_source_location(ptr @10, i64 54, i64 5)
  %scores.load5 = load ptr, ptr %scores, align 8
  %yogi_object_get.call = call ptr @yogi_object_get(ptr %scores.load5, ptr @11)
  %yogi_any_to_number.call = call double @yogi_any_to_number(ptr %yogi_object_get.call)
  call void @yogi_memory_pop_source_location()
  call void @yogi_array_drop(ptr %scores.array.storage)
  call void @yogi_memory_pop_context()
  ret double %yogi_any_to_number.call
}

declare i64 @yogi_array_sizeof()

declare void @yogi_array_init(ptr, i64)

declare ptr @yogi_any_from_number(double)

declare void @yogi_array_set(ptr, i64, ptr)

declare i64 @yogi_array_push(ptr, ptr)

declare ptr @yogi_array_pop(ptr)

declare ptr @yogi_array_at(ptr, i64)

declare ptr @yogi_object_get(ptr, ptr)

declare double @yogi_any_to_number(ptr)

declare void @yogi_array_drop(ptr)

define internal double @_yogi_fn_main_io_findThreshold(ptr %scores, double %threshold) {
entry:
  %value = alloca double, align 8
  %i = alloca double, align 8
  %result = alloca double, align 8
  %threshold2 = alloca double, align 8
  %scores1 = alloca ptr, align 8
  call void @yogi_memory_push_context(ptr @12, ptr @13)
  store ptr %scores, ptr %scores1, align 8
  store double %threshold, ptr %threshold2, align 8
  call void @yogi_memory_push_source_location(ptr @14, i64 61, i64 9)
  call void @yogi_memory_pop_source_location()
  store double 0.000000e+00, ptr %result, align 8
  call void @yogi_memory_push_source_location(ptr @15, i64 63, i64 14)
  call void @yogi_memory_pop_source_location()
  store double 0.000000e+00, ptr %i, align 8
  br label %for.cond

for.cond:                                         ; preds = %for.inc, %entry
  %i.load = load double, ptr %i, align 8
  %scores.load = load ptr, ptr %scores1, align 8
  %yogi_object_get.call = call ptr @yogi_object_get(ptr %scores.load, ptr @16)
  %yogi_any_to_number.call = call double @yogi_any_to_number(ptr %yogi_object_get.call)
  %cmptmp = fcmp olt double %i.load, %yogi_any_to_number.call
  br i1 %cmptmp, label %for.body, label %for.end

for.body:                                         ; preds = %for.cond
  call void @yogi_memory_push_source_location(ptr @17, i64 64, i64 13)
  %scores.load3 = load ptr, ptr %scores1, align 8
  %i.load4 = load double, ptr %i, align 8
  %numtoindextmp = fptoui double %i.load4 to i64
  %yogi_array_get.call = call ptr @yogi_array_get(ptr %scores.load3, i64 %numtoindextmp)
  %yogi_any_to_number.call5 = call double @yogi_any_to_number(ptr %yogi_array_get.call)
  call void @yogi_memory_pop_source_location()
  store double %yogi_any_to_number.call5, ptr %value, align 8
  %value.load = load double, ptr %value, align 8
  %threshold.load = load double, ptr %threshold2, align 8
  %cmptmp6 = fcmp ogt double %value.load, %threshold.load
  br i1 %cmptmp6, label %if.then, label %if.end

for.inc:                                          ; preds = %if.end10, %if.then9
  %i.load12 = load double, ptr %i, align 8
  %addtmp13 = fadd double %i.load12, 1.000000e+00
  store double %addtmp13, ptr %i, align 8
  br label %for.cond

for.end:                                          ; preds = %if.then, %for.cond
  call void @yogi_memory_push_source_location(ptr @18, i64 78, i64 5)
  %result.load14 = load double, ptr %result, align 8
  call void @yogi_memory_pop_source_location()
  call void @yogi_memory_pop_context()
  ret double %result.load14

if.then:                                          ; preds = %for.body
  %value.load7 = load double, ptr %value, align 8
  store double %value.load7, ptr %result, align 8
  br label %for.end

if.end:                                           ; preds = %for.body
  %value.load8 = load double, ptr %value, align 8
  %eqtmp = fcmp oeq double %value.load8, 0.000000e+00
  br i1 %eqtmp, label %if.then9, label %if.end10

if.then9:                                         ; preds = %if.end
  br label %for.inc

if.end10:                                         ; preds = %if.end
  %result.load = load double, ptr %result, align 8
  %value.load11 = load double, ptr %value, align 8
  %addtmp = fadd double %result.load, %value.load11
  store double %addtmp, ptr %result, align 8
  br label %for.inc
}

declare ptr @yogi_array_get(ptr, i64)

define void @_yogi_module_init_main_io() {
entry:
  %auditPassed = alloca i1, align 1
  %auditLabel = alloca ptr, align 8
  call void @yogi_memory_push_context(ptr @19, ptr @20)
  call void @yogi_memory_push_source_location(ptr @21, i64 10, i64 5)
  call void @yogi_memory_pop_source_location()
  store double 0.000000e+00, ptr @_yogi_main_io_retryCount, align 8
  call void @yogi_memory_push_source_location(ptr @22, i64 11, i64 5)
  %yogi_any_from_number.call = call ptr @yogi_any_from_number(double 1.000000e+01)
  call void @yogi_memory_pop_source_location()
  store ptr %yogi_any_from_number.call, ptr @_yogi_main_io_externalPayload, align 8
  call void @yogi_memory_push_source_location(ptr @23, i64 12, i64 5)
  call void @yogi_memory_pop_source_location()
  store ptr null, ptr @_yogi_main_io_status, align 8
  call void @yogi_memory_push_source_location(ptr @24, i64 13, i64 5)
  call void @yogi_memory_pop_source_location()
  store ptr null, ptr @_yogi_main_io_cachedOwner, align 8
  call void @yogi_memory_push_source_location(ptr @25, i64 14, i64 5)
  call void @yogi_memory_pop_source_location()
  store ptr @26, ptr @_yogi_main_io_owner, align 8
  store ptr @27, ptr @_yogi_main_io_cachedOwner, align 8
  call void @yogi_memory_push_source_location(ptr @28, i64 17, i64 5)
  %hasEnoughScore.load = load i1, ptr @_yogi_scoring_io_hasEnoughScore, align 1
  br i1 %hasEnoughScore.load, label %cond.then, label %cond.else

cond.then:                                        ; preds = %entry
  br label %cond.end

cond.else:                                        ; preds = %entry
  br label %cond.end

cond.end:                                         ; preds = %cond.else, %cond.then
  %condtmp = phi ptr [ @29, %cond.then ], [ @30, %cond.else ]
  call void @yogi_memory_pop_source_location()
  store ptr %condtmp, ptr @_yogi_main_io_releaseName, align 8
  call void @yogi_memory_push_source_location(ptr @31, i64 18, i64 5)
  call void @yogi_memory_push_source_location(ptr @32, i64 18, i64 55)
  %yogi_object_create.call = call ptr @yogi_object_create()
  %owner.load = load ptr, ptr @_yogi_main_io_owner, align 8
  %yogi_any_from_string.call = call ptr @yogi_any_from_string(ptr %owner.load)
  call void @yogi_object_set(ptr %yogi_object_create.call, ptr @33, ptr %yogi_any_from_string.call)
  call void @yogi_memory_pop_source_location()
  call void @yogi_memory_pop_source_location()
  store ptr %yogi_object_create.call, ptr @_yogi_main_io_auditTarget, align 8
  %releaseName.load = load ptr, ptr @_yogi_main_io_releaseName, align 8
  %yogi_any_from_string.call1 = call ptr @yogi_any_from_string(ptr %releaseName.load)
  %auditTarget.load = load ptr, ptr @_yogi_main_io_auditTarget, align 8
  call void @yogi_object_set(ptr %auditTarget.load, ptr @34, ptr %yogi_any_from_string.call1)
  call void @yogi_memory_push_source_location(ptr @35, i64 20, i64 5)
  %auditTarget.load2 = load ptr, ptr @_yogi_main_io_auditTarget, align 8
  %yogi_object_get.call = call ptr @yogi_object_get(ptr %auditTarget.load2, ptr @36)
  call void @yogi_memory_pop_source_location()
  store ptr %yogi_object_get.call, ptr @_yogi_main_io_targetRetries, align 8
  call void @yogi_memory_push_source_location(ptr @37, i64 21, i64 5)
  %auditTarget.load3 = load ptr, ptr @_yogi_main_io_auditTarget, align 8
  %yogi_object_get.call4 = call ptr @yogi_object_get(ptr %auditTarget.load3, ptr @38)
  %yogi_any_to_string.call = call ptr @yogi_any_to_string(ptr %yogi_object_get.call4)
  call void @yogi_memory_pop_source_location()
  store ptr %yogi_any_to_string.call, ptr @_yogi_main_io_auditOwner, align 8
  call void @yogi_memory_push_source_location(ptr @39, i64 23, i64 7)
  call void @yogi_memory_push_source_location(ptr @40, i64 23, i64 48)
  %yogi_object_create.call5 = call ptr @yogi_object_create()
  call void @yogi_memory_pop_source_location()
  %yogi_object_get.call6 = call ptr @yogi_object_get(ptr %yogi_object_create.call5, ptr @41)
  %yogi_any_is_nullish.call = call i1 @yogi_any_is_nullish(ptr %yogi_object_get.call6)
  %nullish.has_value = xor i1 %yogi_any_is_nullish.call, true
  br i1 %nullish.has_value, label %nullish.present, label %nullish.fallback

nullish.present:                                  ; preds = %cond.end
  %yogi_any_to_string.call7 = call ptr @yogi_any_to_string(ptr %yogi_object_get.call6)
  br label %nullish.end

nullish.fallback:                                 ; preds = %cond.end
  br label %nullish.end

nullish.end:                                      ; preds = %nullish.fallback, %nullish.present
  %nullishtmp = phi ptr [ %yogi_any_to_string.call7, %nullish.present ], [ @42, %nullish.fallback ]
  call void @yogi_memory_pop_source_location()
  store ptr %nullishtmp, ptr @_yogi_main_io_name, align 8
  call void @yogi_memory_push_source_location(ptr @43, i64 24, i64 6)
  call void @yogi_memory_push_source_location(ptr @44, i64 24, i64 44)
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
  call void @yogi_memory_push_source_location(ptr @45, i64 25, i64 5)
  call void @yogi_memory_push_source_location(ptr @46, i64 25, i64 28)
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
  call void @yogi_memory_push_source_location(ptr @47, i64 27, i64 5)
  %retrySlots.load19 = load ptr, ptr @_yogi_main_io_retrySlots, align 8
  %yogi_array_get.call20 = call ptr @yogi_array_get(ptr %retrySlots.load19, i64 1)
  %yogi_any_to_number.call21 = call double @yogi_any_to_number(ptr %yogi_array_get.call20)
  call void @yogi_memory_pop_source_location()
  store double %yogi_any_to_number.call21, ptr @_yogi_main_io_selectedSlot, align 8
  call void @yogi_memory_push_source_location(ptr @48, i64 29, i64 5)
  %retryCount.load = load double, ptr @_yogi_main_io_retryCount, align 8
  %maxRetries.load = load double, ptr @_yogi_config_io_maxRetries, align 8
  %cmptmp = fcmp olt double %retryCount.load, %maxRetries.load
  call void @yogi_memory_pop_source_location()
  store i1 %cmptmp, ptr @_yogi_main_io_hasRetries, align 1
  call void @yogi_memory_push_source_location(ptr @49, i64 30, i64 5)
  %hasEnoughScore.load22 = load i1, ptr @_yogi_scoring_io_hasEnoughScore, align 1
  %hasRetries.load = load i1, ptr @_yogi_main_io_hasRetries, align 1
  %andtmp = and i1 %hasEnoughScore.load22, %hasRetries.load
  call void @yogi_memory_pop_source_location()
  store i1 %andtmp, ptr @_yogi_main_io_canDeploy, align 1
  %canDeploy.load = load i1, ptr @_yogi_main_io_canDeploy, align 1
  br i1 %canDeploy.load, label %if.then, label %if.end

if.then:                                          ; preds = %nullish.end12
  store ptr @50, ptr @_yogi_main_io_status, align 8
  %retryCount.load23 = load double, ptr @_yogi_main_io_retryCount, align 8
  %priority.load24 = load double, ptr @_yogi_main_io_priority, align 8
  %addtmp = fadd double %retryCount.load23, %priority.load24
  store double %addtmp, ptr @_yogi_main_io_retryCount, align 8
  call void @yogi_memory_push_source_location(ptr @51, i64 36, i64 9)
  call void @yogi_memory_pop_source_location()
  store ptr @52, ptr %auditLabel, align 8
  %auditLabel.load = load ptr, ptr %auditLabel, align 8
  %eqtmp = icmp eq ptr %auditLabel.load, null
  %netmp = xor i1 %eqtmp, true
  br i1 %netmp, label %if.then25, label %if.end26

if.end:                                           ; preds = %if.end26, %nullish.end12
  %status.load = load ptr, ptr @_yogi_main_io_status, align 8
  %eqtmp27 = icmp eq ptr %status.load, null
  br i1 %eqtmp27, label %if.then28, label %if.end29

if.then25:                                        ; preds = %if.then
  call void @yogi_memory_push_source_location(ptr @53, i64 39, i64 13)
  call void @yogi_memory_pop_source_location()
  store i1 true, ptr %auditPassed, align 1
  br label %if.end26

if.end26:                                         ; preds = %if.then25, %if.then
  br label %if.end

if.then28:                                        ; preds = %if.end
  store ptr @54, ptr @_yogi_main_io_status, align 8
  %retryCount.load30 = load double, ptr @_yogi_main_io_retryCount, align 8
  %addtmp31 = fadd double %retryCount.load30, 1.000000e+00
  store double %addtmp31, ptr @_yogi_main_io_retryCount, align 8
  br label %if.end29

if.end29:                                         ; preds = %if.then28, %if.end
  call void @yogi_memory_push_source_location(ptr @55, i64 57, i64 5)
  %_yogi_fn_main_io_computeScore.call = call double @_yogi_fn_main_io_computeScore()
  call void @yogi_memory_pop_source_location()
  store double %_yogi_fn_main_io_computeScore.call, ptr @_yogi_main_io_totalScore, align 8
  call void @yogi_memory_push_source_location(ptr @56, i64 81, i64 5)
  call void @yogi_memory_push_source_location(ptr @57, i64 81, i64 45)
  %yogi_array_create.call32 = call ptr @yogi_array_create(i64 4)
  %yogi_any_from_number.call33 = call ptr @yogi_any_from_number(double 5.000000e+00)
  call void @yogi_array_set(ptr %yogi_array_create.call32, i64 0, ptr %yogi_any_from_number.call33)
  %yogi_any_from_number.call34 = call ptr @yogi_any_from_number(double 3.000000e+00)
  call void @yogi_array_set(ptr %yogi_array_create.call32, i64 1, ptr %yogi_any_from_number.call34)
  %yogi_any_from_number.call35 = call ptr @yogi_any_from_number(double 8.000000e+00)
  call void @yogi_array_set(ptr %yogi_array_create.call32, i64 2, ptr %yogi_any_from_number.call35)
  %yogi_any_from_number.call36 = call ptr @yogi_any_from_number(double 2.000000e+00)
  call void @yogi_array_set(ptr %yogi_array_create.call32, i64 3, ptr %yogi_any_from_number.call36)
  call void @yogi_memory_pop_source_location()
  %_yogi_fn_main_io_findThreshold.call = call double @_yogi_fn_main_io_findThreshold(ptr %yogi_array_create.call32, double 4.000000e+00)
  call void @yogi_memory_pop_source_location()
  store double %_yogi_fn_main_io_findThreshold.call, ptr @_yogi_main_io_thresholdResult, align 8
  call void @yogi_memory_pop_context()
  ret void
}

declare ptr @yogi_object_create()

declare ptr @yogi_any_from_string(ptr)

declare void @yogi_object_set(ptr, ptr, ptr)

declare ptr @yogi_any_to_string(ptr)

declare i1 @yogi_any_is_nullish(ptr)

declare ptr @yogi_array_create(i64)

declare ptr @yogi_any_undefined()

define void @_yogi_module_cleanup_main_io() {
entry:
  call void @yogi_memory_push_context(ptr @58, ptr @59)
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
  %15 = load double, ptr @_yogi_main_io_totalScore, align 8
  store double 0.000000e+00, ptr @_yogi_main_io_totalScore, align 8
  %16 = load double, ptr @_yogi_main_io_thresholdResult, align 8
  store double 0.000000e+00, ptr @_yogi_main_io_thresholdResult, align 8
  call void @yogi_memory_pop_context()
  ret void
}

declare void @yogi_object_destroy(ptr)

declare void @yogi_array_destroy(ptr)

define i32 @main() {
entry:
  call void @yogi_memory_push_context(ptr @60, ptr @61)
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
