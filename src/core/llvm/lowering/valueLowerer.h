// Created by Brayhan De Aza on 6/15/26.
//

#pragma once

#include "llvm/lowering/typeLowerer.h"

#include <optional>
#include <utility>
#include <vector>

#if YOGI_HAS_LLVM
namespace yogi::core::llvm::internal {

	class ValueLowerer {
		public:
			ValueLowerer(ModuleLoweringContext &context, TypeLowerer &types);

			::llvm::Value *lower(
				const Yogi::Sir::ValueRef *value,
				::llvm::Type *expectedType,
				const Yogi::Sir::TypeRef *expectedSemanticType = nullptr
			);
			::llvm::Value *lowerAssignment(const Yogi::Sir::AssignmentExpression *assignment);
			::llvm::Value *lowerBinary(
				const Yogi::Sir::BinaryExpression *binary,
				::llvm::Type *expectedType,
				const Yogi::Sir::TypeRef *expectedSemanticType = nullptr
			);
			::llvm::Value *lowerConditional(
				const Yogi::Sir::ConditionalExpression *conditional,
				::llvm::Type *expectedType,
				const Yogi::Sir::TypeRef *expectedSemanticType = nullptr
			);
			::llvm::Value *lowerCall(
				const Yogi::Sir::CallExpression *call,
				::llvm::Type *expectedType,
				const Yogi::Sir::TypeRef *expectedSemanticType = nullptr
			);
			::llvm::Value *lowerBuiltinMethodCall(
				const Yogi::Sir::CallExpression *call,
				::llvm::Type *expectedType,
				const Yogi::Sir::TypeRef *expectedSemanticType = nullptr
			);
			::llvm::Value *lowerPrintCall(
				const Yogi::Sir::CallExpression *call,
				::llvm::Type *expectedType,
				const Yogi::Sir::TypeRef *expectedSemanticType = nullptr
			);
			::llvm::Value *lowerAggregateAssignment(
				const Yogi::Sir::AggregateAssignmentExpression *assignment
			);
			bool isAggregateLiteral(const Yogi::Sir::ValueRef *value) const;
			::llvm::Value *lowerLocalAggregate(
				const Yogi::Sir::ValueRef *value,
				const std::string &name,
				const Yogi::Sir::TypeRef *declaredType = nullptr
			);
			void dropLocalAggregate(const Yogi::Sir::TypeRef *type, ::llvm::Value *value);
			void destroyEscapedAggregate(const Yogi::Sir::TypeRef *type, ::llvm::Value *value);
			bool isStructType(const Yogi::Sir::TypeRef *type) const;
			::llvm::Value *cast(
				::llvm::Value *value,
				::llvm::Type *targetType,
				const Yogi::Sir::TypeRef *targetSemanticType = nullptr,
				const Yogi::Sir::TypeRef *sourceSemanticType = nullptr
			);
			::llvm::Value *toNumber(::llvm::Value *value, const Yogi::Sir::TypeRef *semanticType = nullptr);
			::llvm::Value *toBoolean(::llvm::Value *value);

		private:
			struct AddressableSlot {
				::llvm::Value *address;
				const Yogi::Sir::TypeRef *type;
			};

			::llvm::Value *lowerConstant(
				const Yogi::Sir::Constant *constant,
				::llvm::Type *expectedType,
				const Yogi::Sir::TypeRef *expectedSemanticType
			);
			::llvm::Value *lowerIdentifier(
				const Yogi::Sir::IdentifierExpression *identifier,
				::llvm::Type *expectedType,
				const Yogi::Sir::TypeRef *expectedSemanticType
			);
				::llvm::Value *lowerAddressOf(
					const Yogi::Sir::AddressOfExpression *addressOf,
					::llvm::Type *expectedType,
					const Yogi::Sir::TypeRef *expectedSemanticType
				);
				::llvm::Value *lowerDereference(
					const Yogi::Sir::DereferenceExpression *dereference,
					::llvm::Type *expectedType,
					const Yogi::Sir::TypeRef *expectedSemanticType
				);
				::llvm::Value *lowerArray(
					const Yogi::Sir::ArrayExpression *array,
				::llvm::Type *expectedType,
				const Yogi::Sir::TypeRef *expectedSemanticType
			);
			::llvm::Value *lowerObject(
				const Yogi::Sir::ObjectExpression *object,
				::llvm::Type *expectedType,
				const Yogi::Sir::TypeRef *expectedSemanticType
			);
			::llvm::Value *lowerStructObject(
				const Yogi::Sir::ObjectExpression *object,
				const std::string &structName,
				::llvm::StructType *structType,
				const std::vector<ModuleLoweringContext::StructFieldInfo> &fields
			);
			::llvm::Value *printStructObject(
				const std::string &structName,
				::llvm::Value *structValue
			);
			void emitStructValidateChain(const std::string &structName, ::llvm::Value *structValue);
			::llvm::Value *coerceStructForValidator(
				const std::string &sourceStructName,
				const std::string &targetStructName,
				::llvm::Value *structValue
			);
			void destroyStructFields(
				const std::string &structName,
				::llvm::Value *structValue,
				bool escaped
			);
			void populateArray(
				const Yogi::Sir::ArrayExpression *array,
				::llvm::Value *aggregate,
				bool appendMode = false
			);
			void populateFixedShapeArray(
				const Yogi::Sir::ArrayExpression *array,
				::llvm::Value *aggregate,
				const Yogi::Sir::TypeRef *arrayType
			);
			void populateObject(const Yogi::Sir::ObjectExpression *object, ::llvm::Value *aggregate);
			bool isFixedShapeArray(const Yogi::Sir::TypeRef *type) const;
			bool isFixedLengthArray(const Yogi::Sir::TypeRef *type) const;
			bool arrayContainsSpread(const Yogi::Sir::ArrayExpression *array) const;
			std::vector<int64_t> fixedShape(const Yogi::Sir::TypeRef *type) const;
			uint64_t fixedShapeElementCount(const std::vector<int64_t> &shape, size_t start = 0) const;
			::llvm::Value *fixedShapeLinearOffset(
				const Yogi::Sir::ElementAccessExpression *access,
				const std::vector<int64_t> &shape,
				size_t consumedDimensions,
				bool sliceStart
			);
			::llvm::Value *createBorrowedFixedShapeView(
				::llvm::Value *array,
				::llvm::Value *startOffset,
				uint64_t length
			);
			::llvm::Value *lowerPropertyAccess(
				const Yogi::Sir::PropertyAccessExpression *access,
				::llvm::Type *expectedType,
				const Yogi::Sir::TypeRef *expectedSemanticType
			);
			::llvm::Value *lowerElementAccess(
				const Yogi::Sir::ElementAccessExpression *access,
				::llvm::Type *expectedType,
				const Yogi::Sir::TypeRef *expectedSemanticType
			);
			::llvm::Value *compare(::llvm::Value *left, ::llvm::Value *right, bool equals);
			bool isSignedIntegerSemanticType(const Yogi::Sir::TypeRef *type) const;
			::llvm::Value *lowerNullish(
				const Yogi::Sir::BinaryExpression *binary,
				::llvm::Type *expectedType,
				const Yogi::Sir::TypeRef *expectedSemanticType
			);
			::llvm::Value *lowerNullishAssignment(
				const Yogi::Sir::BinaryExpression *binary,
				::llvm::Type *expectedType,
				const Yogi::Sir::TypeRef *expectedSemanticType
			);
			::llvm::Value *isNullish(::llvm::Value *value);
			::llvm::Value *toIndex(::llvm::Value *value);
			bool isOwnedStringExpression(const Yogi::Sir::ValueRef *value) const;
			void destroyStringTemporary(::llvm::Value *value);
			void destroyStringTemporaryIfOwned(::llvm::Value *value, const Yogi::Sir::ValueRef *source);
			::llvm::Value *tagRuntimeCellPointer(::llvm::Value *cell);
			::llvm::Value *untagRuntimeCellPointer(::llvm::Value *pointer);
			::llvm::Value *isRuntimeCellPointer(::llvm::Value *pointer);
			::llvm::Value *lowerPointerRead(
				::llvm::Value *pointer,
				const Yogi::Sir::TypeRef *pointeeSemanticType,
				::llvm::Type *expectedType,
				const Yogi::Sir::TypeRef *expectedSemanticType
			);
			void lowerPointerWrite(
				::llvm::Value *pointer,
				::llvm::Value *value,
				const Yogi::Sir::TypeRef *pointeeSemanticType,
				const Yogi::Sir::TypeRef *sourceSemanticType
			);
			::llvm::Value *lowerPointerArrayDescriptor(
				::llvm::Value *pointer,
				const Yogi::Sir::TypeRef *pointeeSemanticType
			);
			std::optional<AddressableSlot> lowerStructAddressableSlot(
				const Yogi::Sir::PropertyAccessExpression *property
			);
			std::optional<AddressableSlot> lowerStructAddressableSlot(const Yogi::Sir::ValueRef *value);
			bool collectPointerStructPropertyChain(
				const Yogi::Sir::PropertyAccessExpression *property,
				const Yogi::Sir::ValueRef *&root,
				std::vector<const Yogi::Sir::PropertyAccessExpression *> &chain
			) const;
			std::optional<std::pair<::llvm::Value *, const Yogi::Sir::TypeRef *>>
			lowerPointerStructFieldPointer(const Yogi::Sir::PropertyAccessExpression *property);
			std::optional<std::pair<::llvm::Value *, const Yogi::Sir::TypeRef *>>
			lowerPointerStructFieldPointer(
				::llvm::Value *pointer,
				const Yogi::Sir::TypeRef *structSemanticType,
				const std::vector<const Yogi::Sir::PropertyAccessExpression *> &chain,
				std::size_t chainIndex
			);
			::llvm::Value *lowerRuntimeObjectCell(const Yogi::Sir::PropertyAccessExpression *property);
			::llvm::Value *lowerRuntimeObjectValue(const Yogi::Sir::ValueRef *value);
			::llvm::Value *lowerAddressableArrayCell(const Yogi::Sir::ElementAccessExpression *access);
			::llvm::Value *boxAny(::llvm::Value *value, const Yogi::Sir::TypeRef *sourceSemanticType);
			::llvm::Value *unboxAny(::llvm::Value *value, const Yogi::Sir::TypeRef *targetSemanticType);
			::llvm::Value *unboxArrayElement(
				::llvm::Value *value,
				::llvm::Type *targetType,
				const Yogi::Sir::TypeRef *targetSemanticType,
				const Yogi::Sir::TypeRef *sourceSemanticType
			);
			::llvm::Value *callRuntime(
				const std::string &name,
				::llvm::Type *returnType,
				const std::vector<::llvm::Value *> &arguments
			);
			const Yogi::Sir::TypeRef *valueSemanticType(const Yogi::Sir::ValueRef *value) const;
			Yogi::Sir::TypeKind resolvedTypeKind(const Yogi::Sir::TypeRef *type) const;
			std::string structTypeName(const Yogi::Sir::TypeRef *type) const;
			bool isAnyType(const Yogi::Sir::TypeRef *type) const;
			::llvm::PointerType *opaquePointer() const;

			ModuleLoweringContext &context;
			TypeLowerer &types;
	};

} // namespace yogi::core::llvm::internal
#endif
