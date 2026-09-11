function parseFun(obj, rhead, rcode,head,body) {
  if(obj.code != '200'){
    return {
      success: false,
      error: obj.msg
    }
  }
  const ids = [
    'F000019954',
    // 'F000059168',
    // 'F000020141',
    // 'F000020144',
    // 'F000020268',
    // 'F000020161',
    // 'F000020194',
    // 'F000020214',
    // 'F000020265',
    // 'F000020224',
    // 'F000020106',
    // 'F000020164',
    // 'F000059170',
    // 'F000050168',
    // 'F000059176',
    // 'F000059174',
    // 'F000061125',
    // 'F000059182',
    // 'F000060592',
    // 'F000059988',
    // 'F000060206'
  ]
  const data = obj.data.list.filter(_=>ids.includes(_.undrugId)).map(_=>{
      //names.add(_.execDepts[0].name)
      return {
        name: _.termName,
        undrugId:_.undrugId,
        labId: _.undrugId,
        execDepts: _.execDepts,
        labSpecimens: _.labSpecimens,
      }
    })
  return {
    success: true,
    //names: Array.from(names),
    data: data
  }
}
