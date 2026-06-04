// Copyright (c) 2024 Siemens
import AwObjectSet from 'viewmodel/AwObjectSetViewModel';

export const awObjectSetSectionRenderFunction = ( props ) => {
    return <AwObjectSet useSection={true} {...props}></AwObjectSet>;
};


export default {
    awObjectSetSectionRenderFunction
};
