#pragma once

#include <string>
#include <vector>
#include <map>

namespace yogi::registry {

class Registry {
public:
  virtual ~Registry() = default;
  virtual std::vector<std::string> getAvailableVersions(const std::string& packageName) = 0;
  virtual void downloadPackage(const std::string& packageName, const std::string& version, const std::string& destination) = 0;
};

class MockRegistry : public Registry {
public:
  explicit MockRegistry(std::map<std::string, std::vector<std::string>> packages);
  std::vector<std::string> getAvailableVersions(const std::string& packageName) override;
  void downloadPackage(const std::string& packageName, const std::string& version, const std::string& destination) override;
private:
  std::map<std::string, std::vector<std::string>> packages_;
};

class FailRegistry : public Registry {
public:
  std::vector<std::string> getAvailableVersions(const std::string& packageName) override;
  void downloadPackage(const std::string& packageName, const std::string& version, const std::string& destination) override;
};

Registry& getRegistry();
void setRegistry(Registry* registry);

} // namespace yogi::registry
