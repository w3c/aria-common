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
    item.insertAdjacentHTML(
        "afterend",
        `<h4 class="role-name" title="${title}" aria-describedby="desc-${title}"><code>${content}</code> <span class="type-indicator">${type}</span>`
    );
    item.remove();
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
    item.insertAdjacentHTML(
        "afterend",
        `<h4><span class="${itemEntry.is}-name" title="${itemEntry.title}" aria-describedby="desc-${itemEntry.title}"><code>${itemEntry.name}</code> <span class="type-indicator">${itemEntry.is}</span></span></h4>`
    );
    item.remove();
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
    indexStatePropPlaceholder.insertAdjacentHTML(
        "afterend",
        `<dl id="index_state_prop" class="compact">${indexStatePropContent}</dl>`
    );
    indexStatePropPlaceholder.remove();
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

                item.prohibited ? " (Except where prohibited)" : ""
            }${
                item.deprecated ? " (Global use deprecated in ARIA 1.2)" : ""
            }</li>\n`;
        })
        .join("");
    const globalStatesPropertiesPlaceholder = document.querySelector(
        "#global_states .placeholder"
    );
    globalStatesPropertiesPlaceholder.insertAdjacentHTML(
        "afterend",
        `<ul>${globalStatesPropertiesContent}</ul>`
    );
    globalStatesPropertiesPlaceholder.remove();

    // Populate role=roletype properties with global properties
    const roletypePropsPlaceholder = document.querySelector(
        "#roletype td.role-properties span.placeholder"
    );
    roletypePropsPlaceholder.insertAdjacentHTML(
        "afterend",
        `<ul>${globalStatesPropertiesContent}</ul>`
    );
    roletypePropsPlaceholder.remove();
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
 * @param {Object} subRoles - the subRoles "array" (overloaded)
 * @param {HTMLement} rdef - rdef element node
 */
const populateSubRoles = (subRoles, rdef) => {
    const title = rdef.innerHTML;
    rdef.parentNode
        .querySelectorAll(".role-parent rref")
        .forEach(function (roleref) {
            const s = roleref.innerText;
            // TODO: this overloading seems weird
            if (!subRoles[s]) {
                subRoles.push(s);
                subRoles[s] = []; // TODO: should this be a set?
            }
            subRoles[s].push(title); // TODO: should this be a set?
        });
};

/**
 *
 * @param {HTMLElement} item - sdef or pdef inside rdef Characteristics table
 * @returns
 */
const extractStatesProperties = function (item) {
    const name = item.getAttribute("title") || item.innerText; // TODO: tests indicate both are needed but why?
    const type = item.localName === "pref" ? "property" : "state";
    const req = item.closest(".role-required-properties");
    const dis = item.closest(".role-disallowed");
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

    // TODO: simplify (from here until sortedList)
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

    let prev; //TODO: get rid of "prev"
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

    const subRoles = [];

    const rdefs = document.querySelectorAll("rdef");
    const rdefsContainer = [...rdefs].map((node) => node.parentNode);

    rdefs.forEach(populateSubRoles.bind(null, subRoles));

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
    rdefs.forEach(populateRoleInfoPropList.bind(null, roleInfo, propList));

    rdefs.forEach(rewriteRdef);

    rdefsContainer.forEach(rewriteDefContainer);

    // TODO: test this on a page where `skipIndex` is truthy
    if (!skipIndex) {
        Object.values(roleInfo).forEach(buildInheritedStatesProperties);

        // Update state and property role references
        const getAllSubRoles = function (role) {
            const ref = subRoles[role];
            if (ref && ref.length) {
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
            } else {
                return [];
            }
        };

        Object.values(propList).forEach(function (item) {
            const section = document.querySelector("#" + item.name);
            let placeholder = section.querySelector(
                ".state-applicability, .property-applicability"
            );
            // TODO: all three cases are near-identical. Can we do more?
            if (placeholder?.innerText === "Placeholder" && item.roles.length) {
                // update the used in roles list
                item.roles.sort();
                placeholder.innerHTML = `<ul>\n${item.roles
                    .map((role) => `<li><rref>${role}</rref></li>\n`)
                    .join("")}</ul>\n`;

                // also update any inherited roles
                const placeholderInheritedRoles = section.querySelector(
                    ".state-descendants, .property-descendants"
                );
                let myList = [];
                item.roles.forEach(function (role) {
                    // TODO: can we simplify this?
                    let children = getAllSubRoles(role);
                    // Some subroles have required properties which are also required by the superclass.
                    // Example: The checked state of radio, which is also required by superclass checkbox.
                    // We only want to include these one time, so filter out the subroles.
                    children = children.filter(function (subrole) {
                        return (
                            subrole.indexOf(propList[item.name].roles) === -1
                        );
                    });
                    myList = myList.concat(children);
                });
                const output = [...new Set(myList)]
                    .sort()
                    .map((role) => `<li><rref>${role}</rref></li>\n`)
                    .join("");

                if (output !== "")
                    placeholderInheritedRoles.innerHTML = `<ul>\n${output}</ul>\n`;
            } else if (
                placeholder?.innerText ===
                    "Use as a global deprecated in ARIA 1.2" &&
                item.roles.length
            ) {
                // update roles list (sort, remove roletype)
                item.roles.sort().splice(item.roles.indexOf("roletype"), 1);
                placeholder.innerHTML = `<ul>\n${item.roles
                    .map((role) => `<li><rref>${role}</rref></li>\n`)
                    .join("")}</ul>\n`;

                // also update any inherited roles
                const placeholderInheritedRoles = section.querySelector(
                    ".state-descendants, .property-descendants"
                );
                let myList = [];
                item.roles.forEach(function (role) {
                    // TODO: can we simplify this?
                    let children = getAllSubRoles(role);
                    // Some subroles have required properties which are also required by the superclass.
                    // Example: The checked state of radio, which is also required by superclass checkbox.
                    // We only want to include these one time, so filter out the subroles.
                    children = children.filter(function (subrole) {
                        return (
                            subrole.indexOf(propList[item.name].roles) === -1
                        );
                    });
                    myList = myList.concat(children);
                });
                const output = [...new Set(myList)]
                    .sort()
                    .map((role) => `<li><rref>${role}</rref></li>\n`)
                    .join("");

                if (output !== "")
                    placeholderInheritedRoles.innerHTML = `<ul>\n${output}</ul>\n`;
            } else if (
                placeholder?.innerText ===
                    "All elements of the base markup except for some roles or elements that prohibit its use" &&
                item.roles.length
            ) {
                // for prohibited roles the roles list just includes those roles which are prohibited... weird I know but it is what it is
                // exclude roletype from the sorted list
                item.roles.sort().splice(item.roles.indexOf("roletype"), 1);

                placeholder.innerHTML = `All elements of the base markup except for the following roles: ${item.roles
                    .map((role) => `<rref>${role}</rref>`)
                    .join(", ")}`;
            }
        });

        // spit out the index
        let node = document.getElementById("index_role");
        let parentNode = node.parentNode;
        let list = document.createElement("dl");
        list.id = "index_role";
        list.className = "compact";
        list.innerHTML = roleIndex;
        parentNode.replaceChild(list, node);

        // and the namefrom lists
        node = document.getElementById("index_fromauthor");
        if (node) {
            parentNode = node.parentNode;
            list = document.createElement("ul");
            list.id = "index_fromauthor";
            list.className = "compact";
            list.innerHTML = fromAuthor;
            parentNode.replaceChild(list, node);
        }

        node = document.getElementById("index_fromheading");
        if (node) {
            parentNode = node.parentNode;
            list = document.createElement("ul");
            list.id = "index_fromheading";
            list.className = "compact";
            list.innerHTML = fromHeading;
            parentNode.replaceChild(list, node);
        }

        node = document.getElementById("index_fromcontent");
        if (node) {
            parentNode = node.parentNode;
            list = document.createElement("ul");
            list.id = "index_fromcontent";
            list.className = "compact";
            list.innerHTML = fromContent;
            parentNode.replaceChild(list, node);
        }

        node = document.getElementById("index_fromprohibited");
        if (node) {
            parentNode = node.parentNode;
            list = document.createElement("ul");
            list.id = "index_fromprohibited";
            list.className = "compact";
            list.innerHTML = fromProhibited;
            parentNode.replaceChild(list, node);
        }
        // assuming we found some parent roles, update those parents with their children
        for (let i = 0; i < subRoles.length; i++) {
            const item = subRoles[subRoles[i]];
            const sortedList = item.sort(function (a, b) {
                return a < b ? -1 : a > b ? 1 : 0;
            });
            let output = "<ul>\n";
            for (let j = 0; j < sortedList.length; j++) {
                output += "<li><rref>" + sortedList[j] + "</rref></li>\n";
            }
            output += "</ul>\n";
            // put it somewhere
            const subRolesContainer = document.querySelector("#" + subRoles[i]);
            if (subRolesContainer) {
                const subRolesListContainer =
                    subRolesContainer.querySelector(".role-children");
                if (subRolesListContainer) {
                    subRolesListContainer.innerHTML = output;
                }
            }
        }
    }

    // prune out unused rows throughout the document
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
                !skipIndex &&
                (item.className === "role-inherited" ||
                    item.className === "role-children" ||
                    item.className === "property-descendants" ||
                    item.className === "state-descendants")
            ) {
                item.parentNode.remove();
            }
        });

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
