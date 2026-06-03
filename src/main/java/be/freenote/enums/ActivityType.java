package be.freenote.enums;

/** Kinds of events recorded in the admin activity log (audit trail). */
public enum ActivityType {
    LOGIN,
    SIGNUP,
    UPLOAD,
    DOC_DELETE,
    DOC_VERIFY,
    USER_BAN
}
