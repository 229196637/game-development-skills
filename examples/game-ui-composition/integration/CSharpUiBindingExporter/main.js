"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
    MANIFEST_FILE_NAME,
    generateFiles
} = require("./generator");

const PROJECT_DIRECTORY = path.resolve(__dirname, "..", "..");
const PUBLISH_SETTINGS_PATH = path.join(PROJECT_DIRECTORY, "settings", "Publish.json");
const ATLAS_MANIFEST_FILE_NAME = ".fgui-atlas-export-manifest.json";

/**
 * 由真实发布字节生成小型包目录，覆盖包括无 C# 绑定的资源包。
 * 参数 packages 为已收集的源包，projectDirectory 为 FGUI 工程根目录。
 * 返回目录路径及条目；缺失发布文件或源包/实际包 ID 不一致时抛出，不拼造 FUI。
 */
function publishPackageManifest(packages, projectDirectory = PROJECT_DIRECTORY) {
    const settings = JSON.parse(fs.readFileSync(path.join(projectDirectory, "settings", "Publish.json"), "utf8"));
    const directory = resolveConfiguredPath(projectDirectory, settings.path, "FGUI 发布目录");
    const entries = packages.map((pkg) => {
        const file = `${pkg.name}_fui.bytes`;
        const bytes = fs.readFileSync(resolveProjectRelativePath(directory, file, "FGUI 包文件"));
        // 与运行库 Read 的包头契约一致，只核对标识/名称，不承担组件二进制解析。
        if (bytes.length < 11 || bytes.readUInt32BE(0) !== 0x46475549 || bytes.readInt32BE(4) < 2 || bytes[8] !== 0)
            throw new Error(`FGUI 包头不受支持：${file}`);
        let offset = 9;
        const readString = () => {
            if (offset + 2 > bytes.length) throw new Error(`FGUI 包头不完整：${file}`);
            const length = bytes.readUInt16BE(offset); offset += 2;
            if (offset + length > bytes.length) throw new Error(`FGUI 包头字符串不完整：${file}`);
            const result = bytes.toString("utf8", offset, offset + length); offset += length;
            return result;
        };
        if (readString() !== pkg.id || readString() !== pkg.name)
            throw new Error(`FGUI 实际发布包与源包标识不匹配：${file}`);
        return { name: pkg.name, id: pkg.id, file, sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
            dependencies: pkg.dependencies || [] };
    }).sort((left, right) => left.name.localeCompare(right.name));
    if (new Set(entries.map((entry) => entry.name)).size !== entries.length || new Set(entries.map((entry) => entry.id)).size !== entries.length)
        throw new Error("FGUI 包目录存在重复名称或 ID。");
    const manifestPath = path.join(directory, "FguiPackageManifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify({ version: 1, packages: entries }, null, 2), "utf8");
    return { manifestPath, packages: entries };
}

/**
 * 将发布设置中的路径统一解析为绝对路径；相对路径固定以 FGUI 工程根目录为基准。
 */
function resolveConfiguredPath(projectDirectory, configuredPath, context) {
    if (!configuredPath || typeof configuredPath !== "string") {
        throw new Error(`${context} 不能为空。`);
    }
    return path.isAbsolute(configuredPath)
        ? path.resolve(configuredPath)
        : path.resolve(projectDirectory, configuredPath);
}

function resolveProjectRelativePath(baseDirectory, relativePath, context) {
    if (!relativePath || path.isAbsolute(relativePath)) {
        throw new Error(`${context} 必须是相对路径。`);
    }
    const resolved = path.resolve(baseDirectory, relativePath);
    const root = path.resolve(baseDirectory);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
        throw new Error(`${context} 超出允许目录：${relativePath}`);
    }
    return resolved;
}

/**
 * 将 FGUI 工程配置的字体复制到运行时目录，并输出供星火 Canvas 加载的字体清单。
 */
function publishFonts(projectDirectory = PROJECT_DIRECTORY) {
    const publishSettingsPath = projectDirectory === PROJECT_DIRECTORY
        ? PUBLISH_SETTINGS_PATH
        : path.join(projectDirectory, "settings", "Publish.json");
    const publishSettings = JSON.parse(fs.readFileSync(publishSettingsPath, "utf8"));
    const fontSettings = publishSettings.sceFontExport;
    if (fontSettings == null || fontSettings.enabled !== true) return null;
    if (!Array.isArray(fontSettings.fonts) || fontSettings.fonts.length === 0) {
        throw new Error("sceFontExport 已启用，但未配置 fonts。");
    }
    if (!publishSettings.path) throw new Error("发布设置缺少 FGUI 二进制输出 path。");

    // FGUI Canvas 运行在 WASI 中，只预打开 AppBundle/user_files；字体必须与 FUI 清单同属
    // 该挂载根目录，运行时通过 font/<family>/xxx.ttf 读取，不能放进未挂载的 ui/font 或 res/font。
    const publishDirectory = resolveConfiguredPath(projectDirectory, publishSettings.path, "发布设置 path");
    const runtimeRoot = path.resolve(publishDirectory, "..");
    const names = new Set();
    const fonts = fontSettings.fonts.map((font) => {
        if (!font || !font.name || !font.source || !font.runtimePath) {
            throw new Error("sceFontExport 的每个字体都必须配置 name、source 和 runtimePath。");
        }
        if (!names.add(font.name)) throw new Error(`sceFontExport 存在重复字体名称：${font.name}`);
        const sourcePath = resolveProjectRelativePath(projectDirectory, font.source, `字体 ${font.name} 的 source`);
        const destinationPath = resolveProjectRelativePath(runtimeRoot, font.runtimePath, `字体 ${font.name} 的 runtimePath`);
        if (!fs.existsSync(sourcePath)) throw new Error(`未找到 FGUI 字体源文件：${sourcePath}`);
        fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
        fs.copyFileSync(sourcePath, destinationPath);
        return { name: font.name, path: font.runtimePath.replace(/\\/g, "/") };
    });
    const defaultFont = fontSettings.defaultFont || fonts[0].name;
    if (!names.has(defaultFont)) throw new Error(`sceFontExport.defaultFont 未出现在 fonts 中：${defaultFont}`);
    fs.mkdirSync(publishDirectory, { recursive: true });
    const manifestPath = path.join(publishDirectory, "FguiFontManifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify({ version: 1, defaultFont, fonts }, null, 2), "utf8");
    return { manifestPath, defaultFont, fonts };
}

/**
 * 将 FairyGUI 发布目录中的图集 PNG 同步到星火可按 image/ 路径加载的 UI 资源目录。
 * FUI 二进制继续保留在 AppBundle/user_files 中，而 Canvas 图片资源必须位于项目 ui/image 下。
 */
function publishAtlasImages(packages, projectDirectory = PROJECT_DIRECTORY) {
    if (!Array.isArray(packages)) throw new Error("图集发布缺少包列表。");
    const publishSettingsPath = projectDirectory === PROJECT_DIRECTORY
        ? PUBLISH_SETTINGS_PATH
        : path.join(projectDirectory, "settings", "Publish.json");
    const publishSettings = JSON.parse(fs.readFileSync(publishSettingsPath, "utf8"));
    if (!publishSettings.path) throw new Error("发布设置缺少 FGUI 二进制输出 path。");

    const sourceDirectory = resolveConfiguredPath(projectDirectory, publishSettings.path, "发布设置 path");
    if (!fs.existsSync(sourceDirectory)) throw new Error(`未找到 FairyGUI 发布目录：${sourceDirectory}`);
    const targetDirectory = path.resolve(projectDirectory, "..", "ui", "image", "fgui");
    fs.mkdirSync(targetDirectory, { recursive: true });

    const packagePrefixes = new Set(packages.map((pkg) => String(pkg.fileName || pkg.name)).filter(Boolean));
    const atlasPattern = /^(?<prefix>.+)_atlas\d+(?:@\d+x)?\.png$/i;
    const atlasFiles = fs.readdirSync(sourceDirectory, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .filter((fileName) => {
            const match = atlasPattern.exec(fileName);
            return match != null && packagePrefixes.has(match.groups.prefix);
        });
    const manifestPath = path.join(targetDirectory, ATLAS_MANIFEST_FILE_NAME);
    const previousFiles = fs.existsSync(manifestPath)
        ? JSON.parse(fs.readFileSync(manifestPath, "utf8")).files || []
        : [];

    for (const fileName of atlasFiles) {
        fs.copyFileSync(path.join(sourceDirectory, fileName), path.join(targetDirectory, fileName));
    }
    for (const fileName of previousFiles) {
        if (atlasFiles.includes(fileName)) continue;
        const stalePath = path.resolve(targetDirectory, fileName);
        if (!stalePath.startsWith(targetDirectory + path.sep)) {
            throw new Error(`图集清单包含越界文件：${fileName}`);
        }
        if (fs.existsSync(stalePath)) fs.unlinkSync(stalePath);
    }
    fs.writeFileSync(manifestPath, JSON.stringify({ files: atlasFiles.sort() }, null, 2), "utf8");
    return { targetDirectory, files: atlasFiles };
}

function decodeXml(value) {
    return String(value || "").replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
        .replace(/&#([0-9]+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)))
        .replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function readXmlAttributes(source) {
    const result = {};
    for (const match of String(source || "").matchAll(/([A-Za-z][A-Za-z0-9]*)="([^"]*)"/g)) result[match[1]] = decodeXml(match[2]);
    return result;
}

function readComponentResources(packageDirectory) {
    const packageXml = fs.readFileSync(path.join(packageDirectory, "package.xml"), "utf8");
    const components = new Map();
    for (const match of packageXml.matchAll(/<component\b([^>]*)\/>/g)) {
        const attributes = readXmlAttributes(match[1]);
        if (!attributes.id || !attributes.name) continue;
        const relativePath = String(attributes.path || "/").replace(/^[/\\]+/, "");
        components.set(path.normalize(path.join(relativePath, attributes.name)), attributes.id);
    }
    return components;
}

/**
 * 发布 FGUI XML 中的文字布局与 Button.title 覆盖，供不依赖 Unity Runtime 的星火 Canvas 还原。
 */
function publishTextManifest(packages, projectDirectory = PROJECT_DIRECTORY) {
    const publishSettingsPath = projectDirectory === PROJECT_DIRECTORY
        ? PUBLISH_SETTINGS_PATH
        : path.join(projectDirectory, "settings", "Publish.json");
    const publishSettings = JSON.parse(fs.readFileSync(publishSettingsPath, "utf8"));
    if (!publishSettings.path) throw new Error("发布设置缺少 FGUI 二进制输出 path。");
    const components = [];
    const overrides = [];
    for (const pkg of packages) {
        const packageDirectory = path.join(projectDirectory, "assets", pkg.name);
        const resourceIds = readComponentResources(packageDirectory);
        for (const xmlPath of enumerateXmlFiles(packageDirectory)) {
            const relative = path.normalize(path.relative(packageDirectory, xmlPath));
            const componentId = resourceIds.get(relative);
            if (!componentId) continue;
            const source = fs.readFileSync(xmlPath, "utf8");
            const texts = [];
            // 含 relation/gear 的文字使用成对标签；文字属性都在开始标签，不能只扫描自闭合 text。
            for (const match of source.matchAll(/<text\b([^>]*)>/g)) {
                const attributes = readXmlAttributes(match[1]);
                if (!attributes.name || attributes.text == null) continue;
                const xy = String(attributes.xy || "0,0").split(",").map(Number);
                const size = String(attributes.size || "0,0").split(",").map(Number);
                texts.push({ name: attributes.name, x: xy[0] || 0, y: xy[1] || 0, width: size[0] || 0, height: size[1] || 0,
                    fontSize: Number(attributes.fontSize) || 16, color: attributes.color || "#ffffff", align: attributes.align || "left",
                    vAlign: attributes.vAlign || "middle", text: attributes.text, strokeColor: attributes.strokeColor || null,
                    strokeSize: attributes.strokeColor ? Number(attributes.strokeSize) || 1 : 0,
                    bold: String(attributes.bold).toLowerCase() === "true" });
            }
            if (texts.length > 0) components.push({ packageId: pkg.id, componentId, texts });

            for (const match of source.matchAll(/<component\b(?![^>]*\/>)\s*([^>]*\bsrc="[^"]+"[^>]*)>([\s\S]*?)<\/component>/g)) {
                const attributes = readXmlAttributes(match[1]);
                const button = match[2].match(/<Button\b([^>]*)\/>/);
                if (!attributes.name || !attributes.src || !button) continue;
                const buttonAttributes = readXmlAttributes(button[1]);
                if (buttonAttributes.title != null) {
                    overrides.push({ packageId: pkg.id, componentId, childName: attributes.name, textName: "title", text: buttonAttributes.title });
                }
            }
        }
    }
    const publishDirectory = resolveConfiguredPath(projectDirectory, publishSettings.path, "发布设置 path");
    fs.mkdirSync(publishDirectory, { recursive: true });
    const manifestPath = path.join(publishDirectory, "FguiTextManifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify({ version: 1, components, overrides }, null, 2), "utf8");
    return { manifestPath, components: components.length, overrides: overrides.length };
}

/**
 * 发布 Button 控制器引用的缩放 Transition，供 Canvas 适配层还原 FGUI Check 按钮动画。
 */
function publishButtonManifest(packages, projectDirectory = PROJECT_DIRECTORY) {
    const publishSettingsPath = projectDirectory === PROJECT_DIRECTORY
        ? PUBLISH_SETTINGS_PATH
        : path.join(projectDirectory, "settings", "Publish.json");
    const publishSettings = JSON.parse(fs.readFileSync(publishSettingsPath, "utf8"));
    if (!publishSettings.path) throw new Error("发布设置缺少 FGUI 二进制输出 path。");
    const buttons = [];
    const parsePair = (value, fallbackX = 1, fallbackY = fallbackX) => {
        // 未填写 scale 时 FairyGUI 使用 1；Number("") 会误变成 0，导致运行时拒绝整个按钮定义。
        const values = String(value || "").split(",").map(part => part.trim() === "" ? NaN : Number(part));
        return [Number.isFinite(values[0]) ? values[0] : fallbackX, Number.isFinite(values[1]) ? values[1] : fallbackY];
    };

    for (const pkg of packages) {
        const packageDirectory = path.join(projectDirectory, "assets", pkg.name);
        const resourceIds = readComponentResources(packageDirectory);
        for (const xmlPath of enumerateXmlFiles(packageDirectory)) {
            const relative = path.normalize(path.relative(packageDirectory, xmlPath));
            const componentId = resourceIds.get(relative);
            if (!componentId) continue;
            const source = fs.readFileSync(xmlPath, "utf8");
            const componentMatch = source.match(/<component\b([^>]*)>/);
            if (!componentMatch) continue;
            const componentAttributes = readXmlAttributes(componentMatch[1]);
            if (!/^button$/i.test(componentAttributes.extention || "")) continue;

            const controllerMatch = Array.from(source.matchAll(/<controller\b([^>]*)>([\s\S]*?)<\/controller>/g))
                .find((match) => readXmlAttributes(match[1]).name === "button");
            if (!controllerMatch) continue;
            const actions = Array.from(controllerMatch[2].matchAll(/<action\b([^>]*)\/>/g))
                .map((match) => readXmlAttributes(match[1]));
            const selectAction = actions.find((action) => action.toPage != null && action.transition);
            const selectName = selectAction?.transition;
            const deselectName = actions.find((action) => action.fromPage === selectAction?.toPage)?.transition;
            if (!selectName || !deselectName) continue;

            const transitions = new Map();
            for (const match of source.matchAll(/<transition\b(?![^>]*\/>)([^>]*)>([\s\S]*?)<\/transition>/g)) {
                const transitionAttributes = readXmlAttributes(match[1]);
                const scaleItem = Array.from(match[2].matchAll(/<item\b([^>]*)\/>/g))
                    .map((item) => readXmlAttributes(item[1]))
                    .find((item) => /^scale$/i.test(item.type || ""));
                if (!transitionAttributes.name || !scaleItem) continue;
                const start = parsePair(scaleItem.startValue);
                const end = parsePair(scaleItem.endValue, start[0], start[1]);
                transitions.set(transitionAttributes.name, {
                    startScaleX: start[0], startScaleY: start[1], endScaleX: end[0], endScaleY: end[1],
                    duration: Number(scaleItem.duration) || 0, ease: scaleItem.ease || "Linear"
                });
            }
            if (!transitions.has(selectName) || !transitions.has(deselectName)) continue;
            const initialScale = parsePair(componentAttributes.scale);
            const buttonMatch = source.match(/<Button\b([^>]*)\/>/);
            const buttonAttributes = readXmlAttributes(buttonMatch?.[1] || "");
            buttons.push({ packageId: pkg.id, componentId, mode: buttonAttributes.mode || "Common",
                initialScaleX: initialScale[0], initialScaleY: initialScale[1],
                select: transitions.get(selectName), deselect: transitions.get(deselectName) });
        }
    }

    const publishDirectory = resolveConfiguredPath(projectDirectory, publishSettings.path, "发布设置 path");
    fs.mkdirSync(publishDirectory, { recursive: true });
    const manifestPath = path.join(publishDirectory, "FguiButtonManifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify({ version: 1, buttons }, null, 2), "utf8");
    return { manifestPath, buttons: buttons.length };
}

/**
 * 读取 Puerts 暴露的 .NET 集合，转换为普通 JavaScript 数组。
 * FairyGUI 不同编辑器版本可能将集合暴露为 Array、List 或 get_Item 接口。
 */
function toArray(value, context) {
    if (value == null) return [];
    if (Array.isArray(value)) return value;
    if (typeof value.ToArray === "function") return Array.from(value.ToArray());
    if (typeof value.get_Count === "function" && typeof value.get_Item === "function") {
        const count = value.get_Count();
        const result = [];
        for (let index = 0; index < count; index += 1) result.push(value.get_Item(index));
        return result;
    }
    if (typeof value.Count === "number" && typeof value.get_Item === "function") {
        const result = [];
        for (let index = 0; index < value.Count; index += 1) result.push(value.get_Item(index));
        return result;
    }
    throw new Error(`${context} 不是可遍历的 FairyGUI 集合。`);
}

/**
 * 从可能为属性或 Puerts getter 的成员中读取值。
 */
function readMember(source, names) {
    for (const name of names) {
        if (source == null) break;
        if (source[name] !== undefined) return source[name];
        const getter = `get_${name}`;
        if (typeof source[getter] === "function") return source[getter]();
    }
    return undefined;
}

function normalizeObjectType(item) {
    const value = readMember(item, ["objectType", "type"]);
    return value == null ? "" : String(value);
}

function isExportedComponent(item) {
    const type = normalizeObjectType(item).toLowerCase();
    const exported = readMember(item, ["exported", "isExported"]);
    return type.includes("component") && exported !== false;
}

function readNamedItems(items, context) {
    return toArray(items, context).map((item) => ({
        name: readMember(item, ["name"]),
        type: normalizeObjectType(item),
        defaultName: readMember(item, ["defaultName", "isDefaultName"]) === true
    })).filter((item) => item.name);
}

/**
 * 将 FairyGUI 编辑器 FPackage 投影为 generator.js 使用的稳定数据模型。
 * 当编辑器 API 字段缺失时显式失败，避免在发布时悄悄生成错误绑定。
 */
function normalizePackage(pkg) {
    const packageName = readMember(pkg, ["name"]);
    const packageId = readMember(pkg, ["id"]);
    const packageItems = toArray(readMember(pkg, ["items"]), `包 ${packageName || "<unknown>"} 的 items`);
    if (!packageName || !packageId) {
        throw new Error("发布回调未提供包 name 或 id。请确认 FairyGUI 编辑器版本支持 FPackage API。");
    }

    const components = packageItems.filter(isExportedComponent).map((item) => {
        const itemName = readMember(item, ["name"]);
        const itemId = readMember(item, ["id"]);
        const component = readMember(item, ["component", "componentData"]);
        if (!itemName || !itemId || component == null) {
            throw new Error(`包 ${packageName} 的组件缺少名称、ID 或组件数据：${itemName || "<unknown>"}。`);
        }
        return {
            name: itemName,
            id: itemId,
            children: readNamedItems(readMember(component, ["children"]), `${packageName}/${itemName} 的 children`),
            controllers: readNamedItems(readMember(component, ["controllers"]), `${packageName}/${itemName} 的 controllers`),
            transitions: readNamedItems(readMember(component, ["transitions"]), `${packageName}/${itemName} 的 transitions`)
        };
    });

    return {
        name: packageName,
        id: packageId,
        fileName: readMember(pkg, ["fileName", "publishFileName"]) || packageName,
        components
    };
}

/**
 * 使用官方 PublishHandler.CollectClasses API 投影发布数据。
 * 该 API 与 FairyGUI 内置 C# 代码生成器使用的 API 相同，能正确获取组件成员。
 */
function normalizePublishHandler(handler) {
    if (handler == null || handler.pkg == null) {
        throw new Error("发布插件没有取得 PublishHandler 或 FPackage。");
    }

    const pkg = handler.pkg;
    const packageName = readMember(pkg, ["name"]);
    const packageId = readMember(pkg, ["id"]);
    const classInfos = toArray(handler.CollectClasses(false, false, null), `包 ${packageName} 的类信息`);

    return {
        name: packageName,
        id: packageId,
        fileName: readMember(handler, ["fileName"]) || packageName,
        components: classInfos.map((classInfo) => {
            const children = [];
            const controllers = [];
            const transitions = [];
            for (const member of toArray(classInfo.members, `${packageName}/${classInfo.resName} 的成员`)) {
                const target = member.group === 0 ? children : member.group === 1 ? controllers : transitions;
                target.push({
                    name: member.name,
                    type: member.type,
                    defaultName: false
                });
            }
            return {
                name: classInfo.resName,
                id: classInfo.resId,
                children,
                controllers,
                transitions
            };
        })
    };
}

/**
 * 读取 package.xml 的 publish 属性。包级设置仅覆盖 FairyGUI 全局发布设置中明确声明的字段。
 */
function readPackagePublishSettings(packageName, projectDirectory = PROJECT_DIRECTORY) {
    const packageSettingsPath = path.join(projectDirectory, "assets", packageName, "package.xml");
    if (!fs.existsSync(packageSettingsPath)) return {};

    const source = fs.readFileSync(packageSettingsPath, "utf8");
    const publishElement = source.match(/<publish\b([^>]*)\/?>/i);
    if (publishElement == null) return {};

    const attributes = publishElement[1];
    const readAttribute = (name) => {
        const match = attributes.match(new RegExp(`\\b${name}="([^"]*)"`, "i"));
        return match == null ? undefined : match[1];
    };
    const genCode = readAttribute("genCode");
    return {
        enabled: genCode == null ? undefined : genCode.toLowerCase() === "true",
        codePath: readAttribute("codePath")
    };
}

/**
 * 解析星火专用生成开关和目录。它刻意独立于 FairyGUI 内置 Unity C# 生成，
 * 从而避免发布时写回依赖 Unity FairyGUI Runtime 的 UI_*.cs 文件。
 */
function resolveCodeGenerationPlan(packages, projectDirectory = PROJECT_DIRECTORY) {
    const publishSettingsPath = projectDirectory === PROJECT_DIRECTORY
        ? PUBLISH_SETTINGS_PATH
        : path.join(projectDirectory, "settings", "Publish.json");
    if (!fs.existsSync(publishSettingsPath)) {
        throw new Error(`未找到 FairyGUI 发布设置：${publishSettingsPath}`);
    }

    const publishSettings = JSON.parse(fs.readFileSync(publishSettingsPath, "utf8"));
    const globalSettings = publishSettings.sceCodeGeneration;
    if (globalSettings == null || globalSettings.enabled !== true) {
        return { packages: [], outputDirectory: null };
    }

    const enabledPackages = [];
    const outputDirectories = new Set();
    for (const pkg of packages) {
        const packageSettings = readPackagePublishSettings(pkg.name, projectDirectory);
        if (packageSettings.enabled === false) continue;
        const configuredOutputDirectory = globalSettings.codePath;
        if (!configuredOutputDirectory) {
            throw new Error(`包 ${pkg.name} 未配置本地生成代码路径。`);
        }
        enabledPackages.push(pkg);
        outputDirectories.add(resolveConfiguredPath(projectDirectory, configuredOutputDirectory, "sceCodeGeneration.codePath"));
    }

    if (outputDirectories.size > 1) {
        throw new Error(`启用本地代码生成的包配置了多个输出目录：${Array.from(outputDirectories).join("；")}`);
    }
    return {
        packages: enabledPackages,
        outputDirectory: outputDirectories.size === 0 ? null : Array.from(outputDirectories)[0]
    };
}

function writeGeneratedFiles(files, outputDirectory) {
    fs.mkdirSync(outputDirectory, { recursive: true });
    const manifestPath = path.join(outputDirectory, MANIFEST_FILE_NAME);
    const previousFiles = fs.existsSync(manifestPath)
        ? JSON.parse(fs.readFileSync(manifestPath, "utf8")).files || []
        : [];
    const currentFiles = [];

    for (const [filePath, content] of files) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, content, "utf8");
        currentFiles.push(path.relative(outputDirectory, filePath));
    }

    for (const relativePath of previousFiles) {
        if (currentFiles.includes(relativePath)) continue;
        const staleFilePath = path.resolve(outputDirectory, relativePath);
        if (!staleFilePath.startsWith(path.resolve(outputDirectory) + path.sep)) {
            throw new Error(`生成清单包含越界文件：${relativePath}。`);
        }
        if (fs.existsSync(staleFilePath)) fs.unlinkSync(staleFilePath);
    }

    fs.writeFileSync(manifestPath, JSON.stringify({ files: currentFiles }, null, 2), "utf8");
}

const pendingPackages = new Map();
let pendingProject = null;

/**
 * 在批量发布开始时清空上一次发布缓存。
 */
function onPublishStart() {
    pendingPackages.clear();
    pendingProject = null;
}

/**
 * FairyGUI 的 onPublish 回调。先使用 PublishHandler 收集每个包的强类型成员信息。
 */
function onPublish(handler) {
    const pkg = normalizePublishHandler(handler);
    pendingPackages.set(pkg.id, pkg);
    pendingProject = handler.project;
}

/**
 * 以项目内所有包为唯一真相重建全局配置，避免只发布单包时丢失其它模块。
 */
function collectProjectPackages(project, createHandler) {
    const packages = toArray(readMember(project, ["allPackages"]), "项目包列表");
    const branch = readMember(project, ["activeBranch"]);
    return packages.map((pkg) => normalizePublishHandler(createHandler(pkg, branch)));
}

function createProjectPublishHandler(pkg, branch) {
    const FairyEditor = CS.FairyEditor;
    return new FairyEditor.PublishHandler(pkg, branch);
}

function enumerateXmlFiles(directory) {
    const files = [];
    const pending = [directory];
    while (pending.length > 0) {
        const current = pending.pop();
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const entryPath = path.join(current, entry.name);
            if (entry.isDirectory()) pending.push(entryPath);
            else if (entry.isFile() && entry.name.toLowerCase().endsWith(".xml")) files.push(entryPath);
        }
    }
    return files;
}

/**
 * 从包组件 XML 的 pkg 属性提取跨包引用，并转换为稳定的包名/包 ID 契约。
 */
function attachPackageDependencies(packages, projectDirectory = PROJECT_DIRECTORY) {
    const packagesById = new Map(packages.map((pkg) => [pkg.id, pkg]));
    return packages.map((pkg) => {
        const packageDirectory = path.join(projectDirectory, "assets", pkg.name);
        if (!fs.existsSync(packageDirectory)) {
            throw new Error(`未找到包 ${pkg.name} 的资源目录：${packageDirectory}`);
        }

        const dependencyIds = new Set();
        for (const xmlPath of enumerateXmlFiles(packageDirectory)) {
            const source = fs.readFileSync(xmlPath, "utf8");
            for (const match of source.matchAll(/\bpkg="([^"]+)"/g)) {
                if (match[1] !== pkg.id) dependencyIds.add(match[1]);
            }
        }
        const dependencies = Array.from(dependencyIds).map((dependencyId) => {
            const dependency = packagesById.get(dependencyId);
            if (dependency == null) {
                throw new Error(`包 ${pkg.name} 引用了未知 FairyGUI 包：${dependencyId}`);
            }
            return { name: dependency.name, id: dependency.id };
        }).sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
        return { ...pkg, dependencies };
    });
}

/**
 * FairyGUI 的发布结束回调。在全部包收集完成后一次性生成跨包配置。
 */
function onPublishEnd(pkgs) {
    const packages = pendingProject != null
        ? collectProjectPackages(pendingProject, createProjectPublishHandler)
        : pendingPackages.size > 0
            ? Array.from(pendingPackages.values())
            : toArray(pkgs, "发布回调参数").map(normalizePackage);
    const packagesWithDependencies = attachPackageDependencies(packages);
    const generationPlan = resolveCodeGenerationPlan(packagesWithDependencies);
    // 图集、字体和文字清单均是星火运行时资源契约，不能因某个包关闭 C# 绑定生成而遗漏。
    const atlasExport = publishAtlasImages(packagesWithDependencies);
    const fontExport = publishFonts();
    const textExport = publishTextManifest(packagesWithDependencies);
    const buttonExport = publishButtonManifest(packagesWithDependencies);
    publishPackageManifest(packagesWithDependencies);
    if (generationPlan.packages.length === 0) {
        pendingPackages.clear();
        console.log("[CSharpUiBindingExporter] FairyGUI 本地生成代码未启用，跳过补充绑定生成。");
        if (fontExport != null)
            console.log(`[CSharpUiBindingExporter] 已导出 ${fontExport.fonts.length} 个星火字体：${fontExport.manifestPath}`);
        console.log(`[CSharpUiBindingExporter] 已同步 ${atlasExport.files.length} 张图集到：${atlasExport.targetDirectory}`);
        console.log(`[CSharpUiBindingExporter] 已导出 ${textExport.components} 个文字组件和 ${textExport.overrides} 个文字覆盖：${textExport.manifestPath}`);
        console.log(`[CSharpUiBindingExporter] 已导出 ${buttonExport.buttons} 个 Button 动画定义：${buttonExport.manifestPath}`);
        return;
    }

    const files = generateFiles(generationPlan.packages, generationPlan.outputDirectory);
    writeGeneratedFiles(files, generationPlan.outputDirectory);
    pendingPackages.clear();
    console.log(`[CSharpUiBindingExporter] 已按 FairyGUI 本地代码路径生成 ${files.size} 个 C# 文件：${generationPlan.outputDirectory}`);
    if (fontExport != null)
        console.log(`[CSharpUiBindingExporter] 已导出 ${fontExport.fonts.length} 个星火字体：${fontExport.manifestPath}`);
    console.log(`[CSharpUiBindingExporter] 已同步 ${atlasExport.files.length} 张图集到：${atlasExport.targetDirectory}`);
    console.log(`[CSharpUiBindingExporter] 已导出 ${textExport.components} 个文字组件和 ${textExport.overrides} 个文字覆盖：${textExport.manifestPath}`);
    console.log(`[CSharpUiBindingExporter] 已导出 ${buttonExport.buttons} 个 Button 动画定义：${buttonExport.manifestPath}`);
}

module.exports = {
    publishPackageManifest,
    normalizePackage,
    normalizePublishHandler,
    attachPackageDependencies,
    publishAtlasImages,
    publishButtonManifest,
    publishFonts,
    publishTextManifest,
    collectProjectPackages,
    onPublish,
    onPublishEnd,
    onPublishStart,
    readPackagePublishSettings,
    resolveConfiguredPath,
    resolveCodeGenerationPlan,
    toArray,
    writeGeneratedFiles
};
