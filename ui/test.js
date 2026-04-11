function paraphraseFun(resObj, resHead, resStatus, reqHead, reqBody, url){
  const obj =  this.defaultValue(resObj)
  const sourceList = Array.isArray(obj) ? obj : [];
  const docMap = new Map();

  sourceList.forEach((item) => {
    const key = `${item.deptId}__${item.docId}`;
    
    if (!docMap.has(key)) {
      docMap.set(key, {
        imgUrl: item.imgUrl || "",
        deptName: item.deptName || "",
        docName: item.docName || "",
        docId: item.docId || "",
        docGoodAt: item.docGoodAt || "",
        deptId: item.deptId || "",
        docInfo: item.docInfo || "",
        dateInfoMap: new Map(),
        title: item.title || "",
        xmid: item.xmid || ""
      });
    }

    const doc = docMap.get(key);
    const dateKey = `${item.seeDate}__${item.noonCode}__${item.scheduleId}`;
    
    if (!doc.dateInfoMap.has(dateKey)) {
      doc.dateInfoMap.set(dateKey, {
        fee: item.fee || 0,
        seeDate: item.seeDate || "",
        count: item.count || 0,
        noonCode: item.noonCode || "",
        scheduleId: item.scheduleId || "",
        scheduleTime: []
      });
    }

    const dateInfo = doc.dateInfoMap.get(dateKey);
    if (Array.isArray(item.scheduleTime)) {
      dateInfo.scheduleTime.push(...item.scheduleTime);
    }
  });

  const data = Array.from(docMap.values()).map((doc) => {
    const dateInfo = Array.from(doc.dateInfoMap.values()).map((info) => {
      const fee = info.scheduleTime && info.scheduleTime.length > 0 ? info.scheduleTime[0].fee : info.fee;
      return {
        fee,
        seeDate: info.seeDate,
        count: info.count,
        noonCode: info.noonCode,
        scheduleId: info.scheduleId,
        scheduleTime: info.scheduleTime
      };
    }).sort((a, b) => {
      if (a.seeDate !== b.seeDate) {
        return a.seeDate.localeCompare(b.seeDate);
      }
      return Number(a.noonCode) - Number(b.noonCode);
    });

    return {
      imgUrl: doc.imgUrl,
      deptName: doc.deptName,
      docName: doc.docName,
      docId: doc.docId,
      docGoodAt: doc.docGoodAt,
      deptId: doc.deptId,
      docInfo: doc.docInfo,
      xmid: doc.xmid || "",
      dateInfo,
      title: doc.title
    };
  });

  return {
    success: true,
    data,
  };
}

