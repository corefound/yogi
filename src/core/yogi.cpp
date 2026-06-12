#include <iostream>
#include <filesystem>
#include <string>
#include <vector>
#include <sstream>
#include <json.hpp>
#include "core.h"
#include "libs/flatbuffers/flatbuffers.h"

namespace {
	std::string fb_string(const flatbuffers::String *value) {
		return value ? value->str() : "";
	}

	std::string type_raw(const Yogi::Sir::TypeRef *type) {
		if (!type) {
			return "unknown";
		}

		if (type->kind() == Yogi::Sir::TypeKind_union_type && type->types()) {
			std::string output;
			bool first = true;

			for (const auto *child: *type->types()) {
				if (!first) {
					output += " | ";
				}

				first = false;
				output += type_raw(child);
			}

			return output.empty() ? fb_string(type->raw()) : output;
		}

		if (type->kind() == Yogi::Sir::TypeKind_intersection_type && type->types()) {
			std::string output;
			bool first = true;

			for (const auto *child: *type->types()) {
				if (!first) {
					output += " & ";
				}

				first = false;
				output += type_raw(child);
			}

			return output.empty() ? fb_string(type->raw()) : output;
		}

		if (type->kind() == Yogi::Sir::TypeKind_tuple_type && type->types()) {
			std::string output = "[";
			bool first = true;

			for (const auto *child: *type->types()) {
				if (!first) {
					output += ", ";
				}

				first = false;
				output += type_raw(child);
			}

			output += "]";
			return output;
		}

		if (type->kind() == Yogi::Sir::TypeKind_array_type && type->element_type()) {
			return type_raw(type->element_type()) + "[]";
		}

		if (type->kind() == Yogi::Sir::TypeKind_type_reference) {
			const auto name = fb_string(type->name());

			if (const auto *resolved = type->resolved()) {
				return name.empty()
					? type_raw(resolved)
					: name + " (= " + type_raw(resolved) + ")";
			}

			return name.empty() ? fb_string(type->raw()) : name;
		}

		return fb_string(type->raw());
	}

	std::string constant_value(const Yogi::Sir::Constant *constant) {
		if (!constant) {
			return "<none>";
		}

		if (const auto *value = constant->value_as_NumberConstant()) {
			if (constant->raw()) {
				return fb_string(constant->raw());
			}

			std::ostringstream output;
			output << value->value();
			return output.str();
		}

		if (const auto *value = constant->value_as_StringConstant()) {
			return "\"" + fb_string(value->value()) + "\"";
		}

		if (const auto *value = constant->value_as_BooleanConstant()) {
			return value->value() ? "true" : "false";
		}

		if (constant->value_as_NullConstant()) {
			return "null";
		}

		if (constant->value_as_UndefinedConstant()) {
			return "undefined";
		}

		return "<unknown constant>";
	}

	std::string binary_expression(const Yogi::Sir::BinaryExpression *expression);
	std::string assignment_expression(const Yogi::Sir::AssignmentExpression *expression);

	std::string value_ref(const Yogi::Sir::ValueRef *value) {
		if (!value) {
			return "<none>";
		}

		if (const auto *constant = value->constant()) {
			return constant_value(constant);
		}

		if (const auto *identifier = value->identifier()) {
			return fb_string(identifier->name());
		}

		if (const auto *binary = value->binary()) {
			return binary_expression(binary);
		}

		if (const auto *assignment = value->assignment()) {
			return assignment_expression(assignment);
		}

		return "<unknown value>";
	}

	std::string binary_expression(const Yogi::Sir::BinaryExpression *expression) {
		if (!expression) {
			return "<none>";
		}

		return value_ref(expression->left()) + " " +
			fb_string(expression->operator_()) + " " +
			value_ref(expression->right());
	}

	std::string assignment_expression(const Yogi::Sir::AssignmentExpression *expression) {
		if (!expression) {
			return "<none>";
		}

		const auto left = expression->left()
			? fb_string(expression->left()->name())
			: "<missing>";

		return left + " = " + value_ref(expression->right());
	}

	void dump_sir_node(const Yogi::Sir::SirNode *sir_node, int indent);

	void dump_block(const Yogi::Sir::BlockStatement *block, const int indent) {
		if (!block || !block->statements()) {
			return;
		}

		for (const auto *statement: *block->statements()) {
			dump_sir_node(statement, indent);
		}
	}

	void dump_function(const Yogi::Sir::FunctionDeclaration *function, const int indent) {
		const std::string pad(indent, ' ');
		std::cout << pad << "fn " << fb_string(function->name()) << "(";

		if (function->parameters()) {
			bool first = true;

			for (const auto *parameter: *function->parameters()) {
				if (!first) {
					std::cout << ", ";
				}

				first = false;
				std::cout << fb_string(parameter->name())
					<< ": " << type_raw(parameter->type());
			}
		}

		std::cout << "): " << type_raw(function->return_type()) << "\n";
		dump_block(function->body(), indent + 2);
	}

	void dump_sir_node(const Yogi::Sir::SirNode *sir_node, const int indent) {
		const std::string pad(indent, ' ');

		if (const auto *variable = sir_node->value_as_VariableDeclaration()) {
			std::cout << pad << "var " << fb_string(variable->name())
				<< ": " << type_raw(variable->type())
				<< " = " << value_ref(variable->value())
				<< " [scope " << variable->scope_id() << "]\n";
			return;
		}

		if (const auto *statement = sir_node->value_as_IfStatement()) {
			std::cout << pad << "if (" << value_ref(statement->condition()) << ")\n";
			dump_block(statement->then_block(), indent + 2);
			return;
		}

		if (const auto *function = sir_node->value_as_FunctionDeclaration()) {
			dump_function(function, indent);
			return;
		}

		if (const auto *statement = sir_node->value_as_ReturnStatement()) {
			std::cout << pad << "return " << value_ref(statement->value()) << "\n";
			return;
		}

		if (const auto *assignment = sir_node->value_as_AssignmentExpression()) {
			std::cout << pad << assignment_expression(assignment) << "\n";
			return;
		}

		if (const auto *binary = sir_node->value_as_BinaryExpression()) {
			std::cout << pad << binary_expression(binary) << "\n";
			return;
		}

		if (const auto *constant = sir_node->value_as_Constant()) {
			std::cout << pad << "const " << constant_value(constant) << "\n";
		}
	}
}

int main(const int argc, const char *argv[]) {
	const yogi::core::Core core(argc, argv);
	std::vector<std::uint8_t> storage;
	const std::string path = "/Users/brayhandeaza/Documents/dev/projects/ts-bk/yogi/tests/packages/.cache/meta.fb";
	const auto *build_meta = yogi::libs::fbs::FlatBuffers::read_build_meta_from_file(path, storage);

	for (const auto *node: *build_meta->modules()) {
		std::cout << "raw: " << node->name()->str() << "\n";
		std::cout << "sir_path: " << node->sir_path()->str() << "\n";
		std::cout << "ast_path: " << node->ast_path()->str() << "\n";
		std::cout << "object_path: " << node->object_path()->str() << "\n";
		std::cout << "source_path: " << node->source_path()->str() << "\n";
		std::cout << "source_hash: " << node->source_hash()->str() << "\n";
		std::cout << "ast_hash: " << node->ast_hash()->str() << "\n";
		std::cout << "sir_hash: " << node->sir_hash()->str() << "\n";
		std::cout << "is_entry: " << node->is_entry() << "\n";
		std::cout << "should_lower: " << node->should_lower() << "\n";
		std::cout << "root_path: " << node->root_path()->str() << "\n";

		std::vector<std::uint8_t> ast_storage;
		const auto ast_path = (
			std::filesystem::path(node->root_path()->str()) /
			std::filesystem::path(node->ast_path()->str())
		).string();
		const auto *ast_module = yogi::libs::fbs::FlatBuffers::read_ast_module_from_file(ast_path, ast_storage);
		std::cout << "ast_nodes: " << (ast_module->nodes() ? ast_module->nodes()->size() : 0) << "\n";

		std::vector<std::uint8_t> sir_storage;
		const auto sir_path = (
			std::filesystem::path(node->root_path()->str()) /
			std::filesystem::path(node->sir_path()->str())
		).string();
		const auto *sir_module = yogi::libs::fbs::FlatBuffers::read_sir_module_from_file(sir_path, sir_storage);

		if (sir_module->nodes()) {
			for (const auto *sir_node: *sir_module->nodes()) {
				if (const auto *extern_declaration = sir_node->value_as_ExternDeclaration()) {
					std::cout << "extern: " << extern_declaration->name()->str()
						<< " from " << extern_declaration->path()->str() << "\n";

					if (extern_declaration->functions()) {
						for (const auto *function: *extern_declaration->functions()) {
							std::cout << "  fn " << function->name()->str() << "(";

							if (function->parameters()) {
								bool first = true;

								for (const auto *parameter: *function->parameters()) {
									if (!first) {
										std::cout << ", ";
									}

									first = false;
									std::cout << parameter->name()->str()
										<< ": " << parameter->type()->raw()->str();
								}
							}

							std::cout << "): " << function->return_type()->raw()->str() << "\n";
						}
					}

					if (extern_declaration->variables()) {
						for (const auto *variable: *extern_declaration->variables()) {
							std::cout << "  var " << variable->name()->str()
								<< ": " << variable->type()->raw()->str() << "\n";
						}
					}
				}

				if (
					sir_node->value_as_VariableDeclaration() ||
					sir_node->value_as_IfStatement() ||
					sir_node->value_as_FunctionDeclaration() ||
					sir_node->value_as_ReturnStatement() ||
					sir_node->value_as_AssignmentExpression() ||
					sir_node->value_as_BinaryExpression() ||
					sir_node->value_as_Constant()
				) {
					dump_sir_node(sir_node, 0);
				}
			}
		}
	}

	std::cout << core.ast.dump(1) << std::endl;
}
