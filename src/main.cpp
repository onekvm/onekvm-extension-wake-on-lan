#include <arpa/inet.h>
#include <sys/socket.h>
#include <unistd.h>

#include <algorithm>
#include <array>
#include <cctype>
#include <cerrno>
#include <cstdint>
#include <cstring>
#include <fstream>
#include <iostream>
#include <iterator>
#include <string>
#include <string_view>

namespace {

constexpr std::string_view kExtensionID = "wake-on-lan";
constexpr std::size_t kMaxControllerInput = 1U << 20;

void SkipWhitespace(std::string_view input, std::size_t &position) {
  while (position < input.size() &&
         std::isspace(static_cast<unsigned char>(input[position])))
    ++position;
}

bool AppendUTF8(std::uint32_t codepoint, std::string &output) {
  if (codepoint <= 0x7f) {
    output.push_back(static_cast<char>(codepoint));
  } else if (codepoint <= 0x7ff) {
    output.push_back(static_cast<char>(0xc0 | (codepoint >> 6)));
    output.push_back(static_cast<char>(0x80 | (codepoint & 0x3f)));
  } else if (codepoint <= 0xffff) {
    if (codepoint >= 0xd800 && codepoint <= 0xdfff)
      return false;
    output.push_back(static_cast<char>(0xe0 | (codepoint >> 12)));
    output.push_back(static_cast<char>(0x80 | ((codepoint >> 6) & 0x3f)));
    output.push_back(static_cast<char>(0x80 | (codepoint & 0x3f)));
  } else if (codepoint <= 0x10ffff) {
    output.push_back(static_cast<char>(0xf0 | (codepoint >> 18)));
    output.push_back(static_cast<char>(0x80 | ((codepoint >> 12) & 0x3f)));
    output.push_back(static_cast<char>(0x80 | ((codepoint >> 6) & 0x3f)));
    output.push_back(static_cast<char>(0x80 | (codepoint & 0x3f)));
  } else {
    return false;
  }
  return true;
}

int HexDigit(char character) {
  if (character >= '0' && character <= '9')
    return character - '0';
  character = static_cast<char>(
      std::tolower(static_cast<unsigned char>(character)));
  return character >= 'a' && character <= 'f' ? character - 'a' + 10 : -1;
}

bool ParseHex4(std::string_view input, std::size_t &position,
               std::uint32_t &value) {
  if (position + 4 > input.size())
    return false;
  value = 0;
  for (int index = 0; index < 4; ++index) {
    const int digit = HexDigit(input[position++]);
    if (digit < 0)
      return false;
    value = (value << 4) | static_cast<std::uint32_t>(digit);
  }
  return true;
}

bool ParseJSONString(std::string_view input, std::size_t &position,
                     std::string &output) {
  if (position >= input.size() || input[position++] != '"')
    return false;
  output.clear();
  while (position < input.size()) {
    const unsigned char character =
        static_cast<unsigned char>(input[position++]);
    if (character == '"')
      return true;
    if (character < 0x20)
      return false;
    if (character != '\\') {
      output.push_back(static_cast<char>(character));
      continue;
    }
    if (position >= input.size())
      return false;
    switch (input[position++]) {
    case '"': output.push_back('"'); break;
    case '\\': output.push_back('\\'); break;
    case '/': output.push_back('/'); break;
    case 'b': output.push_back('\b'); break;
    case 'f': output.push_back('\f'); break;
    case 'n': output.push_back('\n'); break;
    case 'r': output.push_back('\r'); break;
    case 't': output.push_back('\t'); break;
    case 'u': {
      std::uint32_t codepoint = 0;
      if (!ParseHex4(input, position, codepoint))
        return false;
      if (codepoint >= 0xd800 && codepoint <= 0xdbff) {
        if (position + 2 > input.size() || input[position] != '\\' ||
            input[position + 1] != 'u')
          return false;
        position += 2;
        std::uint32_t low = 0;
        if (!ParseHex4(input, position, low) || low < 0xdc00 || low > 0xdfff)
          return false;
        codepoint = 0x10000 + ((codepoint - 0xd800) << 10) + (low - 0xdc00);
      }
      if (!AppendUTF8(codepoint, output))
        return false;
      break;
    }
    default:
      return false;
    }
  }
  return false;
}

bool SkipJSONValue(std::string_view input, std::size_t &position,
                   unsigned depth) {
  if (depth > 32)
    return false;
  SkipWhitespace(input, position);
  if (position >= input.size())
    return false;
  if (input[position] == '"') {
    std::string ignored;
    return ParseJSONString(input, position, ignored);
  }
  if (input[position] == '{') {
    ++position;
    SkipWhitespace(input, position);
    if (position < input.size() && input[position] == '}') {
      ++position;
      return true;
    }
    while (position < input.size()) {
      std::string key;
      if (!ParseJSONString(input, position, key))
        return false;
      SkipWhitespace(input, position);
      if (position >= input.size() || input[position++] != ':' ||
          !SkipJSONValue(input, position, depth + 1))
        return false;
      SkipWhitespace(input, position);
      if (position < input.size() && input[position] == '}') {
        ++position;
        return true;
      }
      if (position >= input.size() || input[position++] != ',')
        return false;
      SkipWhitespace(input, position);
    }
    return false;
  }
  if (input[position] == '[') {
    ++position;
    SkipWhitespace(input, position);
    if (position < input.size() && input[position] == ']') {
      ++position;
      return true;
    }
    while (position < input.size()) {
      if (!SkipJSONValue(input, position, depth + 1))
        return false;
      SkipWhitespace(input, position);
      if (position < input.size() && input[position] == ']') {
        ++position;
        return true;
      }
      if (position >= input.size() || input[position++] != ',')
        return false;
    }
    return false;
  }
  for (std::string_view literal : {"true", "false", "null"}) {
    if (input.substr(position, literal.size()) == literal) {
      position += literal.size();
      return true;
    }
  }
  std::size_t cursor = position;
  if (input[cursor] == '-')
    ++cursor;
  if (cursor >= input.size())
    return false;
  if (input[cursor] == '0') {
    ++cursor;
  } else if (input[cursor] >= '1' && input[cursor] <= '9') {
    while (cursor < input.size() && std::isdigit(
               static_cast<unsigned char>(input[cursor])))
      ++cursor;
  } else {
    return false;
  }
  if (cursor < input.size() && input[cursor] == '.') {
    ++cursor;
    const std::size_t digits = cursor;
    while (cursor < input.size() && std::isdigit(
               static_cast<unsigned char>(input[cursor])))
      ++cursor;
    if (cursor == digits)
      return false;
  }
  if (cursor < input.size() &&
      (input[cursor] == 'e' || input[cursor] == 'E')) {
    ++cursor;
    if (cursor < input.size() &&
        (input[cursor] == '+' || input[cursor] == '-'))
      ++cursor;
    const std::size_t digits = cursor;
    while (cursor < input.size() && std::isdigit(
               static_cast<unsigned char>(input[cursor])))
      ++cursor;
    if (cursor == digits)
      return false;
  }
  position = cursor;
  return true;
}

bool ValidJSON(std::string_view input) {
  std::size_t position = 0;
  if (!SkipJSONValue(input, position, 0))
    return false;
  SkipWhitespace(input, position);
  return position == input.size();
}

bool FindObjectMember(std::string_view object, std::string_view wanted,
                      std::string_view &value) {
  std::size_t position = 0;
  SkipWhitespace(object, position);
  if (position >= object.size() || object[position++] != '{')
    return false;
  SkipWhitespace(object, position);
  while (position < object.size() && object[position] != '}') {
    std::string key;
    if (!ParseJSONString(object, position, key))
      return false;
    SkipWhitespace(object, position);
    if (position >= object.size() || object[position++] != ':')
      return false;
    SkipWhitespace(object, position);
    const std::size_t begin = position;
    if (!SkipJSONValue(object, position, 1))
      return false;
    if (key == wanted) {
      value = object.substr(begin, position - begin);
      return true;
    }
    SkipWhitespace(object, position);
    if (position < object.size() && object[position] == ',') {
      ++position;
      SkipWhitespace(object, position);
    } else {
      break;
    }
  }
  return false;
}

bool ObjectString(std::string_view object, std::string_view key,
                  std::string &value) {
  std::string_view encoded;
  if (!FindObjectMember(object, key, encoded))
    return false;
  std::size_t position = 0;
  if (!ParseJSONString(encoded, position, value))
    return false;
  SkipWhitespace(encoded, position);
  return position == encoded.size();
}

bool ParseMAC(std::string_view input, std::array<std::uint8_t, 6> &mac,
              std::string &normalized) {
  if (input.size() != 17)
    return false;
  normalized.clear();
  for (std::size_t index = 0; index < mac.size(); ++index) {
    const std::size_t offset = index * 3;
    auto digit = [](char character) -> int {
      if (character >= '0' && character <= '9')
        return character - '0';
      character = static_cast<char>(std::tolower(static_cast<unsigned char>(character)));
      return character >= 'a' && character <= 'f' ? character - 'a' + 10 : -1;
    };
    const int high = digit(input[offset]);
    const int low = digit(input[offset + 1]);
    if (high < 0 || low < 0 ||
        (index != mac.size() - 1 && input[offset + 2] != ':' &&
         input[offset + 2] != '-'))
      return false;
    mac[index] = static_cast<std::uint8_t>((high << 4) | low);
    static constexpr char hex[] = "0123456789abcdef";
    if (index != 0)
      normalized.push_back(':');
    normalized.push_back(hex[high]);
    normalized.push_back(hex[low]);
  }
  return true;
}

bool SendWakePacket(std::string_view address, std::string &error) {
  std::array<std::uint8_t, 6> mac{};
  std::string normalized;
  if (!ParseMAC(address, mac, normalized)) {
    error = "MAC address must use six hexadecimal octets";
    return false;
  }
  std::array<std::uint8_t, 102> packet{};
  packet.fill(0xff);
  for (std::size_t repeat = 0; repeat < 16; ++repeat)
    std::copy(mac.begin(), mac.end(), packet.begin() + 6 + repeat * 6);

  const int fd = socket(AF_INET, SOCK_DGRAM | SOCK_CLOEXEC, 0);
  if (fd < 0) {
    error = std::string("create Wake-on-LAN socket: ") + std::strerror(errno);
    return false;
  }
  int enabled = 1;
  if (setsockopt(fd, SOL_SOCKET, SO_BROADCAST, &enabled, sizeof(enabled)) < 0) {
    error = std::string("enable UDP broadcast: ") + std::strerror(errno);
    close(fd);
    return false;
  }
  sockaddr_in destination{};
  destination.sin_family = AF_INET;
  destination.sin_port = htons(9);
  destination.sin_addr.s_addr = htonl(INADDR_BROADCAST);
  const auto sent = sendto(fd, packet.data(), packet.size(), 0,
                           reinterpret_cast<sockaddr *>(&destination),
                           sizeof(destination));
  close(fd);
  if (sent != static_cast<ssize_t>(packet.size())) {
    error = std::string("send Wake-on-LAN packet: ") + std::strerror(errno);
    return false;
  }
  return true;
}

bool Controller(std::string &error) {
  std::string input((std::istreambuf_iterator<char>(std::cin)),
                    std::istreambuf_iterator<char>());
  if (input.size() > kMaxControllerInput || !ValidJSON(input)) {
    error = "invalid controller JSON";
    return false;
  }
  std::string event;
  std::string extension_id;
  std::string method;
  if (!ObjectString(input, "event", event) ||
      !ObjectString(input, "extension_id", extension_id) ||
      extension_id != kExtensionID) {
    error = "unsupported controller event";
    return false;
  }
  ObjectString(input, "method", method);
  if (event != "invoke") {
    if (event != "enable" && event != "disable" && event != "reconcile" &&
        event != "config_changed") {
      error = "unsupported controller lifecycle event " + event;
      return false;
    }
    std::cout << R"({"actions":[]})";
    return true;
  }
  if (method != "wake") {
    error = "unknown public method " + method;
    return false;
  }

  std::string mac;
  std::string_view request;
  if (FindObjectMember(input, "request", request))
    ObjectString(request, "mac", mac);
  std::array<std::uint8_t, 6> parsed{};
  std::string normalized;
  if (!ParseMAC(mac, parsed, normalized)) {
    error = "MAC address must use the form 00:11:22:33:44:55";
    return false;
  }
  std::cout << "{\"actions\":[{\"type\":\"exec\",\"name\":\"wake\","
               "\"command\":[\"bin/onekvm-wake-on-lan\",\"--wake\",\""
            << normalized
            << "\"],\"timeout_seconds\":5}],\"response\":{\"sent\":true,"
               "\"mac\":\""
            << normalized << "\"}}";
  return true;
}

} // namespace

int main(int argc, char **argv) {
  std::string error;
  if (argc == 2 && std::string_view(argv[1]) == "--controller") {
    if (Controller(error))
      return 0;
  } else if (argc == 2 && std::string_view(argv[1]) == "--health") {
    return 0;
  } else if (argc == 3 && std::string_view(argv[1]) == "--wake") {
    if (SendWakePacket(argv[2], error))
      return 0;
  } else {
    error = "usage: onekvm-wake-on-lan --controller|--health|--wake MAC";
  }
  std::cerr << "onekvm-wake-on-lan: " << error << '\n';
  return 1;
}
