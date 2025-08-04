import API from "./api";

export const getGroups = async () => {
  const res = await API.get("/groups");
  return res.data;
};

export const createGroup = async (name, members) => {
  const res = await API.post("/groups", { name, members });
  return res.data;
};