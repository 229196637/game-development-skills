"use strict";

/**
 * FairyGUI 发布数据到星火 C# 绑定代码的纯转换器。
 * 它只接收普通 JavaScript 对象，以便脱离编辑器运行单元测试。
 */
const path = require("path");

const DEFAULT_OUTPUT_DIRECTORY = path.resolve(__dirname, "..", "..", "..", "src", "client", "Mod", "FGUI", "Generated");
const ROOT_NAMESPACE = "GameEntry.Fgui.Generated";
const MANIFEST_FILE_NAME = ".csharp-ui-binding-manifest.json";

const CSHARP_KEYWORDS = new Set([
    "abstract", "as", "base", "bool", "break", "byte", "case", "catch", "char",
    "checked", "class", "const", "continue", "decimal", "default", "delegate",
    "do", "double", "else", "enum", "event", "explicit", "extern", "false",
    "finally", "fixed", "float", "for", "foreach", "goto", "if", "implicit",
    "in", "int", "interface", "internal", "is", "lock", "long", "namespace",
    "new", "null", "object", "operator", "out", "override", "params", "private",
    "protected", "public", "readonly", "ref", "return", "sbyte", "sealed",
    "short", "sizeof", "stackalloc", "static", "string", "struct", "switch",
    "this", "throw", "true", "try", "typeof", "uint", "ulong", "unchecked",
    "unsafe", "ushort", "using", "virtual", "void", "volatile", "while"
]);

function toPascalCase(value) {
    const words = String(value).replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .split(/[^A-Za-z0-9]+/).filter(Boolean);
    const result = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join("");
    return result || "Unnamed";
}

function toIdentifier(value) {
    let result = String(value).replace(/[^A-Za-z0-9_]/g, "_");
    if (!result) result = "unnamed";
    if (/^[0-9]/.test(result)) result = `_${result}`;
    if (CSHARP_KEYWORDS.has(result)) result = `@${result}`;
    return result;
}

function escapeString(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

function getComponentClassName(component) {
    return `UI_${toPascalCase(component.name)}`;
}

function getPackageClassName(pkg) {
    return `UI_${toPascalCase(pkg.name)}`;
}

function getPackageNamespace(pkg) {
    return `${ROOT_NAMESPACE}.${toPascalCase(pkg.name)}`;
}

function getGlobalViewEnumMember(pkg, component) {
    return `${toPascalCase(pkg.name)}_${toPascalCase(component.name)}`;
}

function assertValidPackage(pkg) {
    if (!pkg || !pkg.name || !pkg.id) {
        throw new Error("发布插件没有取得包名或包 ID，无法生成稳定 URL。");
    }
    if (!Array.isArray(pkg.components)) {
        throw new Error(`包 ${pkg.name} 缺少组件列表。`);
    }
    if (pkg.dependencies != null && !Array.isArray(pkg.dependencies)) {
        throw new Error(`包 ${pkg.name} 的跨包依赖不是数组。`);
    }
}

function assertUniqueIdentifiers(pkg) {
    const names = new Set();
    for (const component of pkg.components) {
        if (!component.name || !component.id) {
            throw new Error(`包 ${pkg.name} 中存在缺少名称或 ID 的组件。`);
        }
        const className = getComponentClassName(component);
        if (names.has(className)) {
            throw new Error(`包 ${pkg.name} 中组件 C# 类名冲突：${className}。`);
        }
        names.add(className);
    }
}

function generateComponentClassSource(pkg, component) {
    const className = getComponentClassName(component);
    const children = component.children || [];
    const memberNames = new Set();
    const members = [];

    for (const child of children) {
        if (!child.name || child.defaultName) continue;
        const memberName = toIdentifier(child.name);
        if (memberNames.has(memberName)) {
            throw new Error(`组件 ${pkg.name}/${component.name} 的成员名冲突：${memberName}。`);
        }
        memberNames.add(memberName);
        members.push(`"${escapeString(child.name)}"`);
    }

    const properties = children.filter((child) => child.name && !child.defaultName).map((child) => {
        const propertyName = toPascalCase(child.name);
        const runtimeType = ({ text: "FguiTextField", graph: "FguiGraph", image: "FguiImage", loader: "FguiLoader", list: "FguiList", component: "FguiComponent", button: "FguiComponent" })[String(child.type || "").toLowerCase()] || "FguiObject";
        return `    /// <summary>名称为 \"${escapeString(child.name)}\" 的直接子节点。</summary>
    public FguiComponentChild ${propertyName} => RequireChild("${escapeString(child.name)}");
    /// <summary>当前运行实例，需先创建运行根。</summary>
    public ${runtimeType} ${propertyName}Object => RequireObject<${runtimeType}>("${escapeString(child.name)}");`;
    }).join("\n\n");

    return `/// <summary>${pkg.name}/${component.name} 的可实例化强类型 View。</summary>
public sealed class ${className} : FguiView
{
    /// <summary>组件资源唯一标识。</summary>
    public const string ResourceId = "${escapeString(component.id)}";
    /// <summary>稳定 FairyGUI URL。</summary>
    public const string URL = "ui://${escapeString(pkg.id)}${escapeString(component.id)}";
    /// <summary>当前 View 对应的组件资源标识。</summary>
    public override string ComponentId => ResourceId;
    /// <summary>组件与命名成员的生成描述。</summary>
    public static FguiGeneratedComponentDefinition Definition { get; } = new("${escapeString(component.name)}", ResourceId,
        new HashSet<string>(StringComparer.Ordinal) { ${members.join(", ")} });
    /// <summary>创建并绑定当前组件 View。</summary>
    /// <param name="binding">已通过包、组件和节点校验的 FairyGUI 绑定。</param>
    /// <returns>可直接读取命名节点属性的 View 实例。</returns>
    /// <exception cref="ArgumentNullException"><paramref name="binding"/> 为 <see langword="null"/> 时引发。</exception>
    /// <exception cref="InvalidOperationException">绑定中没有当前组件时引发。</exception>
    public static ${className} Create(FguiGeneratedPackageBinding binding)
    {
        var view = new ${className}();
        view.Bind(binding);
        return view;
    }
${properties ? `\n${properties}` : ""}
}`;
}

function generatePackageSource(pkg) {
    const classes = pkg.components.map((component) => generateComponentClassSource(pkg, component)).join("\n\n");
    const componentEntries = pkg.components.map((component) => `[${getComponentClassName(component)}.ResourceId] = ${getComponentClassName(component)}.Definition,`).join("\n            ");
    const dependencyEntries = (pkg.dependencies || []).map((dependency) =>
        `new FguiPackageDependency("${escapeString(dependency.name)}", "${escapeString(dependency.id)}"),`).join("\n            ");
    return `// <auto-generated />
// 此文件由 FGUIProject 的 CSharpUiBindingExporter 在 FairyGUI 发布时生成。
// 请修改 FGUIProject 源资源或导出插件；手动修改会在下次发布时被覆盖。
using FatFrame.Fgui.Runtime.UI;
using GameEntry.Lib.Fgui.Runtime.UI;

namespace ${getPackageNamespace(pkg)};

/// <summary>包 ${pkg.name} 的星火兼容生成绑定。</summary>
public static class ${getPackageClassName(pkg)}
{
    /// <summary>FairyGUI 包名称。</summary>
    public const string PackageName = "${escapeString(pkg.name)}";
    /// <summary>FairyGUI 包唯一标识。</summary>
    public const string PackageId = "${escapeString(pkg.id)}";
    /// <summary>将已解析包绑定到当前生成描述。</summary>
    public static FguiGeneratedPackageBinding Bind(FguiPackageDefinition package) => FguiGeneratedPackageValidator.Bind(package, Definition);
    /// <summary>完整包描述。</summary>
    public static FguiGeneratedPackageDefinition Definition { get; } = new(PackageName, PackageId,
        new Dictionary<string, FguiGeneratedComponentDefinition>(StringComparer.Ordinal)
        {
            ${componentEntries}
        },
        [
            ${dependencyEntries}
        ]);
}

${classes}
`;
}

function generateGlobalConfigSource(packages) {
    return `// <auto-generated />
// 此文件由 FGUIProject 的 CSharpUiBindingExporter 在 FairyGUI 发布时生成。
// 请修改 FGUIProject 源资源或导出插件；手动修改会在下次发布时被覆盖。
namespace ${ROOT_NAMESPACE};

/// <summary>本次 FairyGUI 发布生成的星火兼容包入口。</summary>
public static class FguiGeneratedPackages
{
    /// <summary>本次发布包含的包数量。</summary>
    public const int PackageCount = ${packages.length};
    /// <summary>本次发布所有生成包的绑定契约。</summary>
    public static IReadOnlyList<FatFrame.Fgui.Runtime.UI.FguiGeneratedPackageDefinition> Definitions { get; } =
    [
        ${packages.map((pkg) => `${getPackageNamespace(pkg)}.${getPackageClassName(pkg)}.Definition,`).join("\n        ")}
    ];
}
`;
}

function generateFiles(packages, outputDirectory = DEFAULT_OUTPUT_DIRECTORY) {
    if (!Array.isArray(packages) || packages.length === 0) {
        throw new Error("本次发布没有可生成代码的 FairyGUI 包。");
    }

    const files = new Map();
    const packageNames = new Set();
    for (const pkg of packages) {
        assertValidPackage(pkg);
        assertUniqueIdentifiers(pkg);
        if (packageNames.has(pkg.name)) {
            throw new Error(`发布数据包含重复包：${pkg.name}。`);
        }
        packageNames.add(pkg.name);

        files.set(path.join(outputDirectory, `${toPascalCase(pkg.name)}.cs`), "#if CLIENT\n" + generatePackageSource(pkg) + "\n#endif\n");
    }
    files.set(path.join(outputDirectory, "GUiConfig.cs"), "#if CLIENT\n" + generateGlobalConfigSource(packages) + "\n#endif\n");
    return files;
}

module.exports = {
    DEFAULT_OUTPUT_DIRECTORY,
    MANIFEST_FILE_NAME,
    generateFiles,
    getComponentClassName,
    getPackageClassName,
    toIdentifier,
    toPascalCase
};
