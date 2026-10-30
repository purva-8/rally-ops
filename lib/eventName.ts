// The event's public name: the stored name plus "Badminton Tournament", unless the name already says badminton
export const eventTitle = (name: string) => (/badminton/i.test(name) ? name : `${name.trim()} Badminton Tournament`);
