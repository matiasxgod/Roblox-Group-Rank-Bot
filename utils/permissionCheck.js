const ALLOWED_ROLES = ["Rütbelendirme"];

function checkPermission(member) {
    return member.roles.cache.some(role => ALLOWED_ROLES.includes(role.name));
}

module.exports = { checkPermission };