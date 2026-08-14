/**
 * The only user fields that may be exposed to other lobby members —
 * never password_hash or email. Used by both the REST controllers and the
 * chat socket so a message pushed over the wire leaks no more than one
 * fetched over HTTP.
 */
export const publicUserSelect = {
    id: true,
    username: true,
    profile_image_url: true,
};

export default publicUserSelect;
