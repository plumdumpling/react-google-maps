import React, {useContext} from 'react';
import {act, render, screen} from '@testing-library/react';
import {initialize} from '@googlemaps/jest-mocks';
import '@testing-library/jest-dom';

import {
  APILoadingStatus,
  APIProvider,
  APIProviderContext,
  APIProviderContextValue
} from '../api-provider';
import {ApiParams} from '../../libraries/google-maps-api-loader';
import {useApiIsLoaded} from '../../hooks/api-loading-status';

const apiLoadSpy = jest.fn();
const apiUnloadSpy = jest.fn();

const ContextSpyComponent = () => {
  const context = useContext(APIProviderContext);
  ContextSpyComponent.spy(context);

  return <></>;
};
ContextSpyComponent.spy = jest.fn();

let triggerMapsApiLoaded: () => void;

jest.mock('../../libraries/google-maps-api-loader', () => {
  class GoogleMapsApiLoader {
    static async load(params: ApiParams): Promise<void> {
      apiLoadSpy(params);
      return new Promise(resolve => (triggerMapsApiLoaded = resolve));
    }
    static unload() {
      apiUnloadSpy();
    }
  }

  return {__esModule: true, GoogleMapsApiLoader};
});

beforeEach(() => {
  initialize();
  jest.clearAllMocks();
});

test('passes parameters to GoogleMapsAPILoader', () => {
  render(
    <APIProvider
      apiKey={'apikey'}
      libraries={['places', 'marker']}
      version={'beta'}
      language={'en'}
      region={'us'}
      authReferrerPolicy={'origin'}></APIProvider>
  );

  expect(apiLoadSpy.mock.lastCall[0]).toMatchObject({
    key: 'apikey',
    libraries: 'places,marker',
    version: 'beta',
    language: 'en',
    region: 'us',
    authReferrerPolicy: 'origin'
  });
});

test('renders inner components', async () => {
  const LoadingStatus = () => {
    const mapsLoaded = useApiIsLoaded();
    return <span>{mapsLoaded ? 'loaded' : 'not loaded'}</span>;
  };

  render(
    <APIProvider apiKey={'apikey'}>
      <LoadingStatus />
    </APIProvider>
  );

  expect(screen.getByText('not loaded')).toBeInTheDocument();

  await act(() => triggerMapsApiLoaded());

  expect(screen.getByText('loaded')).toBeInTheDocument();
});

test('provides context values', async () => {
  render(
    <APIProvider apiKey={'apikey'}>
      <ContextSpyComponent />
    </APIProvider>
  );

  const contextSpy = ContextSpyComponent.spy;
  expect(contextSpy).toHaveBeenCalled();
  let actualContext: APIProviderContextValue = contextSpy.mock.lastCall[0];

  expect(actualContext.status).toEqual(APILoadingStatus.LOADING);
  expect(actualContext.mapInstances).toEqual({});

  contextSpy.mockReset();
  await act(() => triggerMapsApiLoaded());

  expect(contextSpy).toHaveBeenCalled();

  actualContext = contextSpy.mock.lastCall[0];
  expect(actualContext.status).toBe(APILoadingStatus.LOADED);
});

test('map instance management: add, access and remove', async () => {
  render(
    <APIProvider apiKey={'apikey'}>
      <ContextSpyComponent />
    </APIProvider>
  );

  const contextSpy = ContextSpyComponent.spy;

  let actualContext: APIProviderContextValue = contextSpy.mock.lastCall[0];
  const map1 = new google.maps.Map(null as unknown as HTMLElement);
  const map2 = new google.maps.Map(null as unknown as HTMLElement);

  contextSpy.mockReset();
  await act(() => {
    actualContext.addMapInstance(map1, 'map-id-1');
    actualContext.addMapInstance(map2, 'map-id-2');
  });

  expect(contextSpy).toHaveBeenCalled();

  actualContext = contextSpy.mock.lastCall[0];
  expect(actualContext.mapInstances['map-id-1']).toBe(map1);
  expect(actualContext.mapInstances['map-id-2']).toBe(map2);

  contextSpy.mockReset();
  await act(() => {
    actualContext.removeMapInstance('map-id-1');
  });

  actualContext = contextSpy.mock.lastCall[0];
  expect(actualContext.mapInstances).toEqual({'map-id-2': map2});
});
