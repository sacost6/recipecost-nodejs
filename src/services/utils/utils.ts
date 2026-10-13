// General utility functions for the backend services
export const toTitleCase = (str: string) => {
  return str
    .toLocaleLowerCase()
    .replace(
      /(^|[^\p{L}\p{N}])(\p{L})/gu,
      (_match, boundary, char) => boundary + char.toLocaleUpperCase(),
    );
};
