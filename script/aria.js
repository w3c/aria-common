/**
 * Clones a node but strips IDs
 * @param {HTMLElement} node - an element node
 * @returns {HTMLElement} - cloned node without IDs
 */
function cloneWithoutIds(node) {
    const clone = node.cloneNode(true);
    for (const elementWithId of clone.querySelectorAll("[id]")) {
        elementWithId.removeAttribute("id");
    }
    return clone;
}

/**
 * roleInfo is structured like this:
 *
 * name: the name of the role
 * fragID: the @id for the role in the document
 * parentRoles: roles from which it inherits
 * localprops: local properties and states
 */

const roleInfo = {};

/**
 * Populates propList for given sdef/pdef
 * @param {Object} propList -
 * @param {HTMLElement} item - from nodeList.forEach
 */
const populatePropList = function (propList, item) {
    const type = item.localName === "pdef" ? "property" : "state";
    const content = item.innerHTML;
    const title = item.getAttribute("title") || content;
    const dRef = item.nextElementSibling;
    const desc = cloneWithoutIds(dRef.firstElementChild).innerHTML;
    propList[title] = {
        is: type,
        title: title,
        name: content,
        desc: desc,
        roles: [],
    };
};

/**
 * Populates globalSP for given sdef/pdef
 * @param {Object} propList -
 * @param {Object} globalSP -
 * @param {HTMLElement} item - from nodeList.forEach
 */
const populateGlobalSP = function (propList, globalSP, item) {
    const title = item.getAttribute("title") || item.innerHTML;
    const container = item.parentElement;
    const itemEntry = propList[title];

    const applicabilityText = container.querySelector(
        "." + itemEntry.is + "-applicability"
    ).innerText;
    const isDefault = applicabilityText === "All elements of the base markup";
    const isProhibited =
        applicabilityText ===
        "All elements of the base markup except for some roles or elements that prohibit its use";
    const isDeprecated =
        applicabilityText === "Use as a global deprecated in ARIA 1.2";
    // NOTE: the only other value for applicabilityText appears to be "Placeholder"
    if (isDefault || isProhibited || isDeprecated) {
        globalSP.push(
            Object.assign(itemEntry, {
                prohibited: isProhibited,
                deprecated: isDeprecated,
            })
        );
    }
};

/**
 *
 * @param {HTMLElement} container - parent of sdef or pdef or rdef
 */
const rewriteDefContainer = (container) => {
    // if we are in a div, convert that div to a section
    // TODO:
    // a) seems to be always the case.
    // b) Why don't we author the spec this way?
    if (container.nodeName.toLowerCase() == "div") {
        // change the enclosing DIV to a section with notoc
        const sec = document.createElement("section");
        [...container.attributes].forEach(function (attr) {
            sec.setAttribute(attr.name, attr.value);
        });
        sec.classList.add("notoc");
        const theContents = container.innerHTML;
        sec.innerHTML = theContents;
        container.parentNode.replaceChild(sec, container);
    }
};

/**
 *
 * @param {HTMLElement} item - rdef element
 */
const rewriteRdef = function (item) {
    // TODO: merge with generateHTMLStatesAndProperties() but that creates different HTML
    const content = item.innerHTML;
    let title = item.getAttribute("title") || content;
    let type = "role";
    const abstract = item.parentNode.querySelectorAll(".role-abstract"); //TODO: maybe #105
    if (abstract.innerText === "True") {
        type = "abstract role";
    }
    const dRef = item.nextElementSibling;
    dRef.id = "desc-" + title;
    dRef.setAttribute("role", "definition");
    item.outerHTML = `<h4 class="role-name" title="${title}" aria-describedby="desc-${title}"><code>${content}</code> <span class="type-indicator">${type}</span>`;
};

/**
 * Replaces sdef/pdef with desired HTML
 * @param {Object} propList -
 * @param {HTMLElement} item - sdef or pdef, from nodeList.forEach
 */
const generateHTMLStatesAndProperties = function (propList, item) {
    const title = item.getAttribute("title") || item.innerHTML;
    const itemEntry = propList[title];
    const dRef = item.nextElementSibling;
    dRef.id = "desc-" + title; // TODO: too much of a side-effect?
    dRef.setAttribute("role", "definition"); // TODO: ditto?
    // Replace pdef/sdef with HTML
    item.outerHTML = `<h4><span class="${itemEntry.is}-name" title="${itemEntry.title}" aria-describedby="desc-${itemEntry.title}"><code>${itemEntry.name}</code> <span class="type-indicator">${itemEntry.is}</span></span></h4>`;
};

/**
 * Generate index of states and properties
 * @param {Object} propList
 */
const generateIndexStatesAndProperties = (propList) => {
    const indexStatePropPlaceholder =
        document.getElementById("index_state_prop");
    const indexStatePropContent = Object.values(propList)
        .map(
            (item) =>
                `<dt><a href="#${item.title}" class="${item.is}-reference">${item.name}</a></dt>\n<dd>${item.desc}</dd>\n`
        )
        .join("");
    indexStatePropPlaceholder.outerHTML = `<dl id="index_state_prop" class="compact">${indexStatePropContent}</dl>`;
};

/**
 * Generate index of global states and properties
 * @param {Object} globalSP
 */
const generateIndexGlobalStatesAndProperties = (globalSP) => {
    const globalStatesPropertiesContent = globalSP
        .map((item) => {
            // TODO: This is the only use of globalSP - why does it not just consist of the markup we create here in this loop?
            const isState = item.is === "state";
            const tagName = isState ? "sref" : "pref";
            return `<li><${tagName} ${
                item.prohibited ? "data-prohibited " : ""
            }${item.deprecated ? "data-deprecated " : ""}${
                isState ? `title="${item.name}"` : ""
            }>${item.name}${isState ? " (state)" : ""}</${tagName}>${
                // TODO: consider moving "(state)" out of sref/pref tag; then maybe remove title attr for sref (after checking resolveReferences interference)
                // TODO: cf. extractStatesProperties() and populateRoleInfoPropList() which have extra logic for title set here)

                item.prohibited ? " (Except where prohibited)" : ""
            }${
                item.deprecated ? " (Global use deprecated in ARIA 1.2)" : ""
            }</li>\n`;
        })
        .join("");
    const globalStatesPropertiesPlaceholder = document.querySelector(
        "#global_states .placeholder"
    );
    globalStatesPropertiesPlaceholder.outerHTML = `<ul>${globalStatesPropertiesContent}</ul>`;

    // Populate role=roletype properties with global properties
    const roletypePropsPlaceholder = document.querySelector(
        "#roletype td.role-properties span.placeholder"
    );
    roletypePropsPlaceholder.outerHTML = `<ul>${globalStatesPropertiesContent}</ul>`;
};

/**
 * For an rdef element, generates DT+DD content to be added to the Index of Roles
 * @param {HTMLElement} item - rdef element
 */
const generateHTMLRoleIndexEntry = function (item) {
    const container = item.parentNode;
    const content = item.innerText;
    container.id = content;
    // is this a role or an abstract role
    let type = "role";
    let isAbstract = false;
    const abstract = container.querySelectorAll(".role-abstract"); //TODO: maybe #105
    if (abstract.innerText === "True") {
        type = "abstract role";
        isAbstract = true;
    }
    const dRef = item.nextElementSibling;
    const desc = cloneWithoutIds(dRef.firstElementChild).innerHTML; // TODO: should the spec markup provide something more robust than "next sibling first child"? [same for sdef/pdef "desc"]
    return `<dt><a href="#${content}" class="role-reference"><code>${content}</code>${
        isAbstract ? " (abstract role) " : ""
    }</a></dt>\n<dd>${desc}</dd>\n`;
};

/**
 * Generates subrole information
 * @param {NodeList} rdefs - rdefs
 */
const generateSubRoles = (rdefs) => {
    const subRoles = {};
    rdefs.forEach((rdef) => {
        const title = rdef.innerHTML;
        rdef.parentNode
            .querySelectorAll(".role-parent rref")
            .forEach(function (roleref) {
                const parentRole = roleref.innerText;
                const parentChildrenRoles = (subRoles[parentRole] ??=
                    new Set());
                parentChildrenRoles.add(title);
            });
    });
    return subRoles;
};

/**
 *
 * @param {HTMLElement} item - sdef or pdef inside rdef Characteristics table
 * @returns
 */
const extractStatesProperties = function (item) {
    const name = item.getAttribute("title") || item.innerText; // TODO: raw HTML doesn't have sref/pref with title attributes but generateIndexGlobalStatesAndProperties() creates them
    const type = item.localName === "pref" ? "property" : "state";
    const req = !!item.closest(".role-required-properties");
    const dis = !!item.closest(".role-disallowed");
    const dep = item.hasAttribute("data-deprecated");
    return {
        is: type,
        name: name,
        required: req,
        disallowed: dis,
        deprecated: dep,
    };
};

/**
 *
 * @param {String} indexTest - string to decide if this index needs it
 * @param {HTMLElement} rdef - rdef node
 */
const generateHTMLNameFromIndices = (indexTest, rdef) => {
    const container = rdef.parentNode;
    // is there a namefrom indication?  If so, add this one to
    // the list
    const roleFromNode = container.querySelector(".role-namefrom");
    // is this a role or an abstract role
    let isAbstract = false;
    const abstract = container.querySelectorAll(".role-abstract"); //TODO: maybe #105
    if (abstract.innerText === "True") {
        isAbstract = true;
    }
    if (!isAbstract && roleFromNode) {
        const content = rdef.innerText;
        const isRequired =
            roleFromNode.closest("table").querySelector(".role-namerequired")
                ?.innerText === "True";
        if (roleFromNode.textContent.indexOf(indexTest) !== -1)
            return `<li><a href="#${content}" class="role-reference"><code>${content}</code></a>${
                isRequired ? " (name required)" : ""
            }</li>`; // TODO: `textContent.indexOf` feels brittle; right now it's either the exact string or proper list markup with LI with exact string
    }
};

/**
 * Populates roleInfo and updates proplist alongside it
 * TODO: separate out propList updates
 * @param {Object} roleInfo - the roleInfo object
 * @param {Object} propList - the "list" of properties
 * @param {HTMLElement} item - an rdef node
 */
const populateRoleInfoPropList = function (roleInfo, propList, item) {
    const container = item.parentNode;
    const content = item.innerText;
    container.id = content;

    // grab info about this role
    // do we have a parent class?  if so, put us in that parents list
    const rrefs = container.querySelectorAll(".role-parent rref");
    const parentRoles = [...rrefs].map((rref) => rref.innerText);
    // are there supported states / properties in this role?
    const PSDefs = container.querySelectorAll(
        `:is(.role-properties, .role-required-properties, .role-disallowed) :is(pref, sref)`
    );
    const attrs = [...PSDefs].map(extractStatesProperties);
    // remember that the state or property is
    // referenced by this role
    PSDefs.forEach((node) =>
        propList[node.getAttribute("title") || node.innerText].roles.push(
            // TODO: cf.  generateIndexGlobalStatesAndProperties() TODO for simplifying title || node.innerText
            content
        )
    );

    roleInfo[content] = {
        name: content,
        fragID: content,
        parentRoles: parentRoles,
        localprops: attrs,
    };
};

/**
 * TODO: depends on global roleInfo object
 * @param {string} role - name of a role
 * @returns
 */
const getStates = function (role) {
    const ref = roleInfo[role];
    if (!ref) {
        msg.pub("error", "No role definition for " + role);
    } else if (ref.allprops) {
        return ref.allprops;
    } else {
        let myList = ref.localprops;
        ref.parentRoles.forEach(function (item) {
            const pList = getStates(item);
            myList = myList.concat(pList);
        });
        ref.allprops = myList;
        return myList;
    }
};

/**
 * Builds up the complete inherited SP lists for each role
 * However, if the role already specifies an item, do not include it
 * @param {Object} item - value from Object.values(roleInfo)
 */
const buildInheritedStatesProperties = function (item) {
    const placeholder = document.querySelector(
        "#" + item.fragID + " .role-inherited"
    );
    if (!placeholder) return;

    // SUPERTODO: simplify (from here until sortedList)
    let myList = [];
    item.parentRoles.forEach(function (role) {
        myList = myList.concat(getStates(role));
    });
    // strip out any items that we have locally
    if (item.localprops.length && myList.length) {
        for (let j = myList.length - 1; j >= 0; j--) {
            item.localprops.forEach(function (x) {
                if (x.name == myList[j].name) {
                    myList.splice(j, 1);
                }
            });
        }
    }

    const reducedList = [...new Set(myList)];

    const sortedList = reducedList.sort((a, b) => {
        if (a.name == b.name) {
            // Ensure deprecated false properties occur first
            if (a.deprecated !== b.deprecated) {
                return a.deprecated ? 1 : b.deprecated ? -1 : 0;
            }
        }
        return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    }, []);

    let prev; //SUPERTODO: get rid of "prev"
    const output = sortedList
        .map((property) => {
            if (prev === property.name) return "";
            prev = property.name;

            const isState = property.is === "state";
            const suffix = isState ? " (state)" : "";
            const tag = isState ? "sref" : "pref";
            const req = property.required ? " <strong>(required)</strong>" : "";
            const dep = property.deprecated
                ? " <strong>(deprecated on this role in ARIA 1.2)</strong>"
                : "";

            return `<li><${tag}>${property.name}</${tag}>${suffix}${req}${dep}</li>\n`;
        })
        .join("");
    if (output !== "") {
        placeholder.innerHTML = `<ul>\n${output}</ul>\n`;
    }
};

/**
 * prune out unused rows throughout the document
 *
 */
const pruneUnusedRows = () => {
    document
        .querySelectorAll(
            ".role-abstract, .role-parent, .role-base, .role-related, .role-scope, .role-mustcontain, .role-required-properties, .role-properties, .role-namefrom, .role-namerequired, .role-namerequired-inherited, .role-childpresentational, .role-presentational-inherited, .state-related, .property-related,.role-inherited, .role-children, .property-descendants, .state-descendants, .implicit-values"
        )
        .forEach(function (item) {
            var content = item.innerText;
            if (content.length === 1 || content.length === 0) {
                // there is no item - remove the row
                item.parentNode.parentNode.removeChild(item.parentNode);
            } else if (
                content === "Placeholder" &&
                (item.className === "role-inherited" ||
                    item.className === "role-children" ||
                    item.className === "property-descendants" ||
                    item.className === "state-descendants")
            ) {
                item.parentNode.remove();
            }
        });
};

/**
 * Generates the HTML for various indices in the spec
 * @param {NodeList} rdefs - all the rdefs
 */
const generateHTMLIndices = (rdefs) => {
    let fromAuthor = [...rdefs]
        .map(generateHTMLNameFromIndices.bind(null, "author"))
        .join("");
    let fromHeading = [...rdefs]
        .map(generateHTMLNameFromIndices.bind(null, "heading"))
        .join("");
    let fromContent = [...rdefs]
        .map(generateHTMLNameFromIndices.bind(null, "content"))
        .join("");
    let fromProhibited = [...rdefs]
        .map(generateHTMLNameFromIndices.bind(null, "prohibited"))
        .join("");

    const roleIndex = [...rdefs].map(generateHTMLRoleIndexEntry).join("");

    // spit out the indices
    document.getElementById(
        "index_role"
    ).outerHTML = `<dl id="index_role" class="compact">${roleIndex}</dl>`;
    document.getElementById(
        "index_fromauthor"
    ).outerHTML = `<ul id="index_fromauthor" class="compact">${fromAuthor}</ul>`;
    document.getElementById(
        "index_fromcontent"
    ).outerHTML = `<ul id="index_fromcontent" class="compact">${fromContent}</ul>`;
    document.getElementById(
        "index_fromprohibited"
    ).outerHTML = `<ul id="index_fromprohibited" class="compact">${fromProhibited}</ul>`;
    // TODO: remove if-check after w3c/aria#1860
    if (document.getElementById("index_fromheading"))
        document.getElementById(
            "index_fromheading"
        ).outerHTML = `<ul id="index_fromheading" class="compact">${fromHeading}</ul>`;
};

/**
 * Creates dictionary of "descendant" roles
 * @param {Object} subRoles - the subroles collection
 * @returns
 */
const createDescendantRoles = (subRoles) => {
    const descendantRoles = {};
    const getAllSubRoles = function (key) {
        if (!subRoles[key]) return []; // NOTE: recursion end
        const ref = [...subRoles[key]];
        // SUPERTODO: refactor the rest here:
        let myList = [];
        ref.forEach(function (item) {
            if (!myList.item) {
                myList[item] = 1;
                myList.push(item);
                const childList = getAllSubRoles(item);
                myList = myList.concat(childList);
            }
        });
        return myList;
    };
    Object.keys(subRoles).forEach(
        (item) => (descendantRoles[item] = getAllSubRoles(item))
    );
    return descendantRoles;
};

/**
 * The propList loop.
 * @param {Object} propList - the propList
 * @param {Object} descendantRoles - the list of "descendant" roles
 * @param {Object} item - value from object.values(propList)
 * @returns
 */
const propListLoop = function (propList, descendantRoles, item) {
    const section = document.querySelector("#" + item.name);
    let placeholder = section.querySelector(
        ".state-applicability, .property-applicability"
    );
    const placeholderText = placeholder.innerText;
    // Current values for placeholderText:
    // * "All elements of the base markup"
    // * "Placeholder"
    // * "Use as a global deprecated in ARIA 1.2"
    // * "All elements of the base markup except for some roles or elements that prohibit its use"
    // TODO: Maybe use a data attribute instead?

    // Case: nothing to do
    if (placeholderText === "All elements of the base markup") return;

    // update roles list: sort & maybe remove roletype
    item.roles.sort();
    if (placeholderText !== "Placeholder")
        item.roles.splice(item.roles.indexOf("roletype"), 1);

    // Case: partially prohibited
    if (
        placeholderText ===
        "All elements of the base markup except for some roles or elements that prohibit its use"
    ) {
        // for prohibited roles the roles list just includes those roles which are prohibited... weird I know but it is what it is

        placeholder.innerHTML = `All elements of the base markup except for the following roles: ${item.roles
            .map((role) => `<rref>${role}</rref>`)
            .join(", ")}`;
        return;
    }

    // Otherwise, i.e.,
    // Cases: placeholderText "Placeholder" or "Use as a global deprecated in ARIA 1.2"

    // populate placeholder
    placeholder.innerHTML = `<ul>\n${item.roles
        .map((role) => `<li><rref>${role}</rref></li>\n`)
        .join("")}</ul>\n`;

    // also update any inherited roles
    const placeholderInheritedRoles = section.querySelector(
        ".state-descendants, .property-descendants"
    );
    let myList = [];
    item.roles.forEach(function (role) {
        // SUPERTODO: can we simplify this?
        let children = descendantRoles[role] || [];
        // Some subroles have required properties which are also required by the superclass.
        // Example: The checked state of radio, which is also required by superclass checkbox.
        // We only want to include these one time, so filter out the subroles.
        children = children.filter(function (subrole) {
            return subrole.indexOf(propList[item.name].roles) === -1;
        });
        myList = myList.concat(children);
    });

    placeholderInheritedRoles.innerHTML = `<ul>\n${[...new Set(myList)]
        .sort()
        .map((role) => `<li><rref>${role}</rref></li>\n`)
        .join("")}</ul>\n`;
};

/**
 * In Object.entries loop, generates HTML for child role entries
 * @param {String} role - subRoles key
 * @param {Object} subRolesSet - subRoles value
 */
const generateHTMLRoleChildren = ([role, subroleSet]) => {
    const item = [...subroleSet];
    document.querySelector(`#${role} .role-children`).innerHTML = `<ul>\n${item
        .map((subrole) => `<li><rref>${subrole}</rref></li>\n`)
        .join("")}</ul>\n`;
};

function ariaAttributeReferences() {
    const propList = {};
    const globalSP = [];

    let skipIndex = 0;
    const myURL = document.URL;
    if (myURL.match(/\?fast/)) {
        skipIndex = 1;
    }

    // process the document before anything else is done
    // first get the properties
    const pdefsAndsdefs = document.querySelectorAll("pdef, sdef");
    const pdefsAndsdefsContainer = [...pdefsAndsdefs].map(
        (node) => node.parentNode
    );

    pdefsAndsdefs.forEach(populatePropList.bind(null, propList));
    pdefsAndsdefs.forEach(populateGlobalSP.bind(null, propList, globalSP));
    pdefsAndsdefs.forEach(generateHTMLStatesAndProperties.bind(null, propList));
    pdefsAndsdefsContainer.forEach(rewriteDefContainer);

    if (!skipIndex) {
        // Generate index of states and properties
        generateIndexStatesAndProperties(propList);

        // Generate index of global states and properties
        generateIndexGlobalStatesAndProperties(globalSP);
    }

    // what about roles?
    //
    // we need to do a few things here:
    //   1. expand the rdef elements.
    //   2. accumulate the roles into a table for the indices
    //   3. grab the parent role reference so we can build up the tree
    //   4. grab any local states and properties so we can hand those down to the children
    //

    const rdefs = document.querySelectorAll("rdef");
    const rdefsContainer = [...rdefs].map((node) => node.parentNode);

    const subRoles = generateSubRoles(rdefs);

    generateHTMLIndices(rdefs);

    rdefs.forEach(populateRoleInfoPropList.bind(null, roleInfo, propList));

    rdefs.forEach(rewriteRdef);

    rdefsContainer.forEach(rewriteDefContainer);

    // TODO: test this on a page where `skipIndex` is truthy
    if (!skipIndex) {
        Object.values(roleInfo).forEach(buildInheritedStatesProperties);

        const descendantRoles = createDescendantRoles(subRoles);

        Object.values(propList).forEach(
            propListLoop.bind(null, propList, descendantRoles)
        );

        // assuming we found some parent roles, update those parents with their children
        Object.entries(subRoles).forEach(generateHTMLRoleChildren);
    }

    pruneUnusedRows();

    updateReferences(document);
}

require(["core/pubsubhub"], function (respecEvents) {
    const button = respecUI.addCommand(
        "Save roles as JSON",
        showAriaSave,
        null,
        "☁️"
    );

    function showAriaSave() {
        const json = JSON.stringify(roleInfo, null, "  ");
        const href =
            "data:text/html;charset=utf-8," +
            "/* This file is generated - do not modify */\nvar roleInfo = " +
            encodeURIComponent(json);
        const ariaUI = document.createElement("div");
        ariaUI.classList.add("respec-save-buttons");
        ariaUI.innerHTML = `
        <a href="${href}" download="roleInfo.json" class="respec-save-button">Save JSON</a>
      `;
        respecUI.freshModal("Save Aria roles as JSON", ariaUI, button);
        ariaUI.querySelector("a").focus();
    }
    respecEvents.sub("end", function (msg) {
        if (msg == "w3c/conformance") {
            ariaAttributeReferences();
        }
    });
});
