import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { nanoid } from "nanoid";
import { useAnonymousAuth } from ".";
import { PUBLISH_ERROR_CODE } from "../constants";
import { Station } from "../generated/stationapi_pb";
import { firestore } from "../vendor";

export const usePublishRoute = () => {
  const { user: anonymousUser } = useAnonymousAuth();

  // NOTE: 完全一致する種別を弾くか検討中。レアケースだと思うが、手間をかけて入力したデータが既に存在するというのは悲しいので。
  const isPublishable = async ({ name }: { name: string | null }) => {
    const { ERR_NOT_AUTHENTICATED, ERR_CONFLICT_NAME } = PUBLISH_ERROR_CODE;

    if (!anonymousUser) {
      return Promise.reject(ERR_NOT_AUTHENTICATED);
    }

    const docsRef = await getDocs(
      collection(firestore, "uploadedCommunityTrainTypes")
    );

    const sameNameAlreadyExists =
      name && docsRef.docs.some((doc) => doc.data().name === name);

    if (sameNameAlreadyExists) {
      return Promise.reject(ERR_CONFLICT_NAME);
    }

    return true;
  };

  const convertToPublishableStations = (stations: Station.AsObject[]) =>
    stations.map((sta) => ({
      id: sta.id,
      stopCondition: sta.stopCondition,
    }));

  const publish = async ({
    name,
    stations,
  }: {
    name: string;
    stations: Station.AsObject[];
  }) => {
    if (!anonymousUser) {
      return;
    }

    try {
      const docId = nanoid();
      await setDoc(doc(firestore, "uploadedCommunityTrainTypes", docId), {
        userId: anonymousUser.uid,
        name,
        stations: convertToPublishableStations(stations),
      });
      return docId;
    } catch (e) {
      return Promise.reject(e);
    }
  };

  return { publish, isPublishable };
};
