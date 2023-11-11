import {
  Timestamp,
  collection,
  doc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { nanoid } from "nanoid";
import { useAnonymousAuth } from ".";
import {
  AvailableTrainType,
  CustomRoute,
  FIRESTORE_COLLECTION_PATH,
  PUBLISH_ERROR_CODE,
  ROUTE_VISIBILITY,
} from "../constants";
import { Station } from "../generated/stationapi_pb";
import { firestore } from "../vendor";

export const usePublishRoute = () => {
  const { user: anonymousUser } = useAnonymousAuth();
  const { UPLOADED_COMMUNITY_ROUTES } = FIRESTORE_COLLECTION_PATH;

  // NOTE: 完全一致する種別を弾くか検討中。レアケースだと思うが、手間をかけて入力したデータが既に存在するというのは悲しいので。
  const isPublishable = async ({ name }: { name: string | null }) => {
    const { ERR_NOT_AUTHENTICATED, ERR_CONFLICT_NAME } = PUBLISH_ERROR_CODE;

    if (!anonymousUser) {
      return Promise.reject(ERR_NOT_AUTHENTICATED);
    }

    const docsRef = await getDocs(
      collection(firestore, UPLOADED_COMMUNITY_ROUTES)
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

  const publish = async (inputData: {
    name: string;
    stations: Station.AsObject[];
    trainType: AvailableTrainType;
  }) => {
    if (!anonymousUser) {
      return;
    }

    const { stations } = inputData;

    try {
      const docId = nanoid();
      const newDoc: CustomRoute = {
        ...inputData,
        userId: anonymousUser.uid,
        stations: convertToPublishableStations(stations),
        createdAt: Timestamp.now(),
        visibility: ROUTE_VISIBILITY.PUBLIC,
      };
      await setDoc(doc(firestore, UPLOADED_COMMUNITY_ROUTES, docId), newDoc);
      return docId;
    } catch (e) {
      return Promise.reject(e);
    }
  };

  return { publish, isPublishable };
};
