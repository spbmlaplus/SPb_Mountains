<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE qgis PUBLIC "http://mrcc.com/qgis.dtd" "SYSTEM">
<qgis version="3.44.8-Solothurn" styleCategories="AllStyleCategories" layername="Finns">
<renderer-v2 forceraster="0" type="RuleRenderer" referencescale="-1" enableorderby="0" symbollevels="0">
        <rules key="{1c9b72cb-c229-4b5c-a250-5d908436be53}">
          <rule filter="&quot;FINNS%&quot; &lt;= 1.0000000000000000" symbol="0" label="Доля финнов &lt;1% от всего населения" key="{1acf14f6-f64a-4d4b-917b-5f3b19647be7}">
            <rule filter="&quot;FINNS&quot; &gt;= 1.0000 AND &quot;FINNS&quot; &lt;= 10.0000" symbol="1" label="Численность финнов 1 - 10 человек" key="{44aec278-a958-4163-b357-e950da501e1c}" />
            <rule filter="&quot;FINNS&quot; &gt; 10.0000 AND &quot;FINNS&quot; &lt;= 100.0000" symbol="2" label="Численность финнов 10  - 100 человек" key="{baf5abd2-a91a-442d-9260-adf92ec4fa5e}" />
            <rule filter="&quot;FINNS&quot; &gt; 100.0000 AND &quot;FINNS&quot; &lt;= 2395.0000" symbol="3" label="Численность финнов более 100 человек" key="{9263bd38-129d-4a4f-a0f5-d49ab6f04607}" />
          </rule>
          <rule filter="&quot;FINNS%&quot; &gt; 1.0000000000000000 AND &quot;FINNS%&quot; &lt;= 3.0000000000000000" symbol="4" label="Доля финнов 1-5% от всего населения " key="{a5c4decc-bcde-40fa-8825-4c98e4d877f2}">
            <rule filter="&quot;FINNS&quot; &gt;= 1.0000 AND &quot;FINNS&quot; &lt;= 10.0000" symbol="5" label="Численность финнов 1 - 10 человек" key="{30b9fb74-3b36-4323-8a98-ef7d0db7e4a7}" />
            <rule filter="&quot;FINNS&quot; &gt; 10.0000 AND &quot;FINNS&quot; &lt;= 100.0000" symbol="6" label="Численность финнов 10  - 100 человек" key="{9520aadc-b4d8-420e-b3f1-4304626332ec}" />
            <rule filter="&quot;FINNS&quot; &gt; 100.0000 AND &quot;FINNS&quot; &lt;= 2395.0000" symbol="7" label="Численность финнов более 100 человек" key="{9924f2ff-49e0-44e4-bfc5-19a758748fd9}" />
          </rule>
          <rule filter="&quot;FINNS%&quot; &gt; 3.0000000000000000" symbol="8" label="Доля финнов &gt;5% от всего населения" key="{822669e4-8b1e-4ff4-a33a-64dd808ed6d4}">
            <rule filter="&quot;FINNS&quot; &gt;= 1.0000 AND &quot;FINNS&quot; &lt;= 10.0000" symbol="9" label="Численность финнов 1 - 10 человек" key="{cee4e46b-4fbb-4448-8eb4-4e5ee0750f45}" />
            <rule filter="&quot;FINNS&quot; &gt; 10.0000 AND &quot;FINNS&quot; &lt;= 100.0000" symbol="10" label="Численность финнов 10  - 100 человек" key="{ac080308-b368-4bc3-9525-655182b04c9e}" />
            <rule filter="&quot;FINNS&quot; &gt; 100.0000 AND &quot;FINNS&quot; &lt;= 2395.0000" symbol="11" label="Численность финнов более 100 человек" key="{aa48d097-63a5-41d7-bba8-38e99863ec1b}" />
          </rule>
        </rules>
        <symbols>
          <symbol frame_rate="10" is_animated="0" clip_to_extent="1" force_rhr="0" type="marker" name="0" alpha="1">
            <data_defined_properties>
              <Option type="Map">
                <Option value="" type="QString" name="name" />
                <Option name="properties" />
                <Option value="collection" type="QString" name="type" />
              </Option>
            </data_defined_properties>
            <layer id="{3e24b19f-c0e6-454a-ab30-ffb7cb4d32fb}" pass="0" enabled="1" locked="0" class="SimpleMarker">
              <Option type="Map">
                <Option value="0" type="QString" name="angle" />
                <Option value="square" type="QString" name="cap_style" />
                <Option value="236,236,236,255,rgb:0.9254902,0.9254902,0.9254902,1" type="QString" name="color" />
                <Option value="1" type="QString" name="horizontal_anchor_point" />
                <Option value="bevel" type="QString" name="joinstyle" />
                <Option value="circle" type="QString" name="name" />
                <Option value="0,0" type="QString" name="offset" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="offset_map_unit_scale" />
                <Option value="MM" type="QString" name="offset_unit" />
                <Option value="29,70,205,255,rgb:0.1137255,0.2745098,0.8039216,1" type="QString" name="outline_color" />
                <Option value="solid" type="QString" name="outline_style" />
                <Option value="0" type="QString" name="outline_width" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="outline_width_map_unit_scale" />
                <Option value="MM" type="QString" name="outline_width_unit" />
                <Option value="diameter" type="QString" name="scale_method" />
                <Option value="1" type="QString" name="size" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="size_map_unit_scale" />
                <Option value="MM" type="QString" name="size_unit" />
                <Option value="1" type="QString" name="vertical_anchor_point" />
              </Option>
              <data_defined_properties>
                <Option type="Map">
                  <Option value="" type="QString" name="name" />
                  <Option name="properties" />
                  <Option value="collection" type="QString" name="type" />
                </Option>
              </data_defined_properties>
            </layer>
          </symbol>
          <symbol frame_rate="10" is_animated="0" clip_to_extent="1" force_rhr="0" type="marker" name="1" alpha="1">
            <data_defined_properties>
              <Option type="Map">
                <Option value="" type="QString" name="name" />
                <Option name="properties" />
                <Option value="collection" type="QString" name="type" />
              </Option>
            </data_defined_properties>
            <layer id="{74f1f57c-78cb-4dc1-838c-14d1fcd31120}" pass="0" enabled="1" locked="0" class="SimpleMarker">
              <Option type="Map">
                <Option value="0" type="QString" name="angle" />
                <Option value="square" type="QString" name="cap_style" />
                <Option value="236,236,236,255,rgb:0.9254902,0.9254902,0.9254902,1" type="QString" name="color" />
                <Option value="1" type="QString" name="horizontal_anchor_point" />
                <Option value="bevel" type="QString" name="joinstyle" />
                <Option value="circle" type="QString" name="name" />
                <Option value="0,0" type="QString" name="offset" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="offset_map_unit_scale" />
                <Option value="MM" type="QString" name="offset_unit" />
                <Option value="29,70,205,255,rgb:0.1137255,0.2745098,0.8039216,1" type="QString" name="outline_color" />
                <Option value="solid" type="QString" name="outline_style" />
                <Option value="0.24" type="QString" name="outline_width" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="outline_width_map_unit_scale" />
                <Option value="MM" type="QString" name="outline_width_unit" />
                <Option value="diameter" type="QString" name="scale_method" />
                <Option value="1.8" type="QString" name="size" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="size_map_unit_scale" />
                <Option value="MM" type="QString" name="size_unit" />
                <Option value="1" type="QString" name="vertical_anchor_point" />
              </Option>
              <data_defined_properties>
                <Option type="Map">
                  <Option value="" type="QString" name="name" />
                  <Option name="properties" />
                  <Option value="collection" type="QString" name="type" />
                </Option>
              </data_defined_properties>
            </layer>
          </symbol>
          <symbol frame_rate="10" is_animated="0" clip_to_extent="1" force_rhr="0" type="marker" name="10" alpha="1">
            <data_defined_properties>
              <Option type="Map">
                <Option value="" type="QString" name="name" />
                <Option name="properties" />
                <Option value="collection" type="QString" name="type" />
              </Option>
            </data_defined_properties>
            <layer id="{77e74b5c-76a9-4a2c-bde6-e0ab1aee7ec7}" pass="0" enabled="1" locked="0" class="SimpleMarker">
              <Option type="Map">
                <Option value="0" type="QString" name="angle" />
                <Option value="square" type="QString" name="cap_style" />
                <Option value="29,70,205,255,rgb:0.1137255,0.2745098,0.8039216,1" type="QString" name="color" />
                <Option value="1" type="QString" name="horizontal_anchor_point" />
                <Option value="bevel" type="QString" name="joinstyle" />
                <Option value="circle" type="QString" name="name" />
                <Option value="0,0" type="QString" name="offset" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="offset_map_unit_scale" />
                <Option value="MM" type="QString" name="offset_unit" />
                <Option value="26,54,127,255,rgb:0.1019608,0.2117647,0.4980392,1" type="QString" name="outline_color" />
                <Option value="solid" type="QString" name="outline_style" />
                <Option value="0" type="QString" name="outline_width" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="outline_width_map_unit_scale" />
                <Option value="MM" type="QString" name="outline_width_unit" />
                <Option value="diameter" type="QString" name="scale_method" />
                <Option value="2.8" type="QString" name="size" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="size_map_unit_scale" />
                <Option value="MM" type="QString" name="size_unit" />
                <Option value="1" type="QString" name="vertical_anchor_point" />
              </Option>
              <data_defined_properties>
                <Option type="Map">
                  <Option value="" type="QString" name="name" />
                  <Option name="properties" />
                  <Option value="collection" type="QString" name="type" />
                </Option>
              </data_defined_properties>
            </layer>
          </symbol>
          <symbol frame_rate="10" is_animated="0" clip_to_extent="1" force_rhr="0" type="marker" name="11" alpha="1">
            <data_defined_properties>
              <Option type="Map">
                <Option value="" type="QString" name="name" />
                <Option name="properties" />
                <Option value="collection" type="QString" name="type" />
              </Option>
            </data_defined_properties>
            <layer id="{c4c0dc7f-49b3-49a5-a17b-5a2a61a3b35a}" pass="0" enabled="1" locked="0" class="SimpleMarker">
              <Option type="Map">
                <Option value="0" type="QString" name="angle" />
                <Option value="square" type="QString" name="cap_style" />
                <Option value="29,70,205,255,rgb:0.1137255,0.2745098,0.8039216,1" type="QString" name="color" />
                <Option value="1" type="QString" name="horizontal_anchor_point" />
                <Option value="bevel" type="QString" name="joinstyle" />
                <Option value="circle" type="QString" name="name" />
                <Option value="0,0" type="QString" name="offset" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="offset_map_unit_scale" />
                <Option value="MM" type="QString" name="offset_unit" />
                <Option value="26,54,127,255,rgb:0.1019608,0.2117647,0.4980392,1" type="QString" name="outline_color" />
                <Option value="solid" type="QString" name="outline_style" />
                <Option value="0" type="QString" name="outline_width" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="outline_width_map_unit_scale" />
                <Option value="MM" type="QString" name="outline_width_unit" />
                <Option value="diameter" type="QString" name="scale_method" />
                <Option value="3.8" type="QString" name="size" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="size_map_unit_scale" />
                <Option value="MM" type="QString" name="size_unit" />
                <Option value="1" type="QString" name="vertical_anchor_point" />
              </Option>
              <data_defined_properties>
                <Option type="Map">
                  <Option value="" type="QString" name="name" />
                  <Option name="properties" />
                  <Option value="collection" type="QString" name="type" />
                </Option>
              </data_defined_properties>
            </layer>
          </symbol>
          <symbol frame_rate="10" is_animated="0" clip_to_extent="1" force_rhr="0" type="marker" name="2" alpha="1">
            <data_defined_properties>
              <Option type="Map">
                <Option value="" type="QString" name="name" />
                <Option name="properties" />
                <Option value="collection" type="QString" name="type" />
              </Option>
            </data_defined_properties>
            <layer id="{ab84fe08-5453-4733-bd5f-c8404546b79e}" pass="0" enabled="1" locked="0" class="SimpleMarker">
              <Option type="Map">
                <Option value="0" type="QString" name="angle" />
                <Option value="square" type="QString" name="cap_style" />
                <Option value="236,236,236,255,rgb:0.9254902,0.9254902,0.9254902,1" type="QString" name="color" />
                <Option value="1" type="QString" name="horizontal_anchor_point" />
                <Option value="bevel" type="QString" name="joinstyle" />
                <Option value="circle" type="QString" name="name" />
                <Option value="0,0" type="QString" name="offset" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="offset_map_unit_scale" />
                <Option value="MM" type="QString" name="offset_unit" />
                <Option value="29,70,205,255,rgb:0.1137255,0.2745098,0.8039216,1" type="QString" name="outline_color" />
                <Option value="solid" type="QString" name="outline_style" />
                <Option value="0.25" type="QString" name="outline_width" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="outline_width_map_unit_scale" />
                <Option value="MM" type="QString" name="outline_width_unit" />
                <Option value="diameter" type="QString" name="scale_method" />
                <Option value="2.8" type="QString" name="size" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="size_map_unit_scale" />
                <Option value="MM" type="QString" name="size_unit" />
                <Option value="1" type="QString" name="vertical_anchor_point" />
              </Option>
              <data_defined_properties>
                <Option type="Map">
                  <Option value="" type="QString" name="name" />
                  <Option name="properties" />
                  <Option value="collection" type="QString" name="type" />
                </Option>
              </data_defined_properties>
            </layer>
          </symbol>
          <symbol frame_rate="10" is_animated="0" clip_to_extent="1" force_rhr="0" type="marker" name="3" alpha="1">
            <data_defined_properties>
              <Option type="Map">
                <Option value="" type="QString" name="name" />
                <Option name="properties" />
                <Option value="collection" type="QString" name="type" />
              </Option>
            </data_defined_properties>
            <layer id="{e0913feb-6bd9-4d3b-b8e0-f754a2450bdf}" pass="0" enabled="1" locked="0" class="SimpleMarker">
              <Option type="Map">
                <Option value="0" type="QString" name="angle" />
                <Option value="square" type="QString" name="cap_style" />
                <Option value="236,236,236,255,rgb:0.9254902,0.9254902,0.9254902,1" type="QString" name="color" />
                <Option value="1" type="QString" name="horizontal_anchor_point" />
                <Option value="bevel" type="QString" name="joinstyle" />
                <Option value="circle" type="QString" name="name" />
                <Option value="0,0" type="QString" name="offset" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="offset_map_unit_scale" />
                <Option value="MM" type="QString" name="offset_unit" />
                <Option value="29,70,205,255,rgb:0.1137255,0.2745098,0.8039216,1" type="QString" name="outline_color" />
                <Option value="solid" type="QString" name="outline_style" />
                <Option value="0.3" type="QString" name="outline_width" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="outline_width_map_unit_scale" />
                <Option value="MM" type="QString" name="outline_width_unit" />
                <Option value="diameter" type="QString" name="scale_method" />
                <Option value="3.8" type="QString" name="size" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="size_map_unit_scale" />
                <Option value="MM" type="QString" name="size_unit" />
                <Option value="1" type="QString" name="vertical_anchor_point" />
              </Option>
              <data_defined_properties>
                <Option type="Map">
                  <Option value="" type="QString" name="name" />
                  <Option name="properties" />
                  <Option value="collection" type="QString" name="type" />
                </Option>
              </data_defined_properties>
            </layer>
          </symbol>
          <symbol frame_rate="10" is_animated="0" clip_to_extent="1" force_rhr="0" type="marker" name="4" alpha="1">
            <data_defined_properties>
              <Option type="Map">
                <Option value="" type="QString" name="name" />
                <Option name="properties" />
                <Option value="collection" type="QString" name="type" />
              </Option>
            </data_defined_properties>
            <layer id="{618bb969-17ce-402f-b7e0-1eaf7a81ac08}" pass="0" enabled="1" locked="0" class="SimpleMarker">
              <Option type="Map">
                <Option value="0" type="QString" name="angle" />
                <Option value="square" type="QString" name="cap_style" />
                <Option value="236,236,236,255,rgb:0.9254902,0.9254902,0.9254902,1" type="QString" name="color" />
                <Option value="1" type="QString" name="horizontal_anchor_point" />
                <Option value="bevel" type="QString" name="joinstyle" />
                <Option value="circle" type="QString" name="name" />
                <Option value="0,0" type="QString" name="offset" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="offset_map_unit_scale" />
                <Option value="MM" type="QString" name="offset_unit" />
                <Option value="29,70,205,255,rgb:0.1137255,0.2745098,0.8039216,1" type="QString" name="outline_color" />
                <Option value="solid" type="QString" name="outline_style" />
                <Option value="0" type="QString" name="outline_width" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="outline_width_map_unit_scale" />
                <Option value="MM" type="QString" name="outline_width_unit" />
                <Option value="diameter" type="QString" name="scale_method" />
                <Option value="1" type="QString" name="size" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="size_map_unit_scale" />
                <Option value="MM" type="QString" name="size_unit" />
                <Option value="1" type="QString" name="vertical_anchor_point" />
              </Option>
              <data_defined_properties>
                <Option type="Map">
                  <Option value="" type="QString" name="name" />
                  <Option name="properties" />
                  <Option value="collection" type="QString" name="type" />
                </Option>
              </data_defined_properties>
            </layer>
            <layer id="{b40cca64-6736-43cc-bc1f-1f54f5a5150d}" pass="0" enabled="1" locked="0" class="SimpleMarker">
              <Option type="Map">
                <Option value="0" type="QString" name="angle" />
                <Option value="square" type="QString" name="cap_style" />
                <Option value="0,48,205,255,rgb:0,0.1882353,0.8039216,1" type="QString" name="color" />
                <Option value="1" type="QString" name="horizontal_anchor_point" />
                <Option value="bevel" type="QString" name="joinstyle" />
                <Option value="circle" type="QString" name="name" />
                <Option value="0,0" type="QString" name="offset" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="offset_map_unit_scale" />
                <Option value="MM" type="QString" name="offset_unit" />
                <Option value="26,54,127,255,rgb:0.1019608,0.2117647,0.4980392,1" type="QString" name="outline_color" />
                <Option value="solid" type="QString" name="outline_style" />
                <Option value="0" type="QString" name="outline_width" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="outline_width_map_unit_scale" />
                <Option value="MM" type="QString" name="outline_width_unit" />
                <Option value="diameter" type="QString" name="scale_method" />
                <Option value="0.425" type="QString" name="size" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="size_map_unit_scale" />
                <Option value="MM" type="QString" name="size_unit" />
                <Option value="1" type="QString" name="vertical_anchor_point" />
              </Option>
              <data_defined_properties>
                <Option type="Map">
                  <Option value="" type="QString" name="name" />
                  <Option name="properties" />
                  <Option value="collection" type="QString" name="type" />
                </Option>
              </data_defined_properties>
            </layer>
          </symbol>
          <symbol frame_rate="10" is_animated="0" clip_to_extent="1" force_rhr="0" type="marker" name="5" alpha="1">
            <data_defined_properties>
              <Option type="Map">
                <Option value="" type="QString" name="name" />
                <Option name="properties" />
                <Option value="collection" type="QString" name="type" />
              </Option>
            </data_defined_properties>
            <layer id="{9638b4b8-ff07-4b6a-9514-6697f9b31a63}" pass="0" enabled="1" locked="0" class="SimpleMarker">
              <Option type="Map">
                <Option value="0" type="QString" name="angle" />
                <Option value="square" type="QString" name="cap_style" />
                <Option value="236,236,236,255,rgb:0.9254902,0.9254902,0.9254902,1" type="QString" name="color" />
                <Option value="1" type="QString" name="horizontal_anchor_point" />
                <Option value="bevel" type="QString" name="joinstyle" />
                <Option value="circle" type="QString" name="name" />
                <Option value="0,0" type="QString" name="offset" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="offset_map_unit_scale" />
                <Option value="MM" type="QString" name="offset_unit" />
                <Option value="29,70,205,255,rgb:0.1137255,0.2745098,0.8039216,1" type="QString" name="outline_color" />
                <Option value="solid" type="QString" name="outline_style" />
                <Option value="0" type="QString" name="outline_width" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="outline_width_map_unit_scale" />
                <Option value="MM" type="QString" name="outline_width_unit" />
                <Option value="diameter" type="QString" name="scale_method" />
                <Option value="1.8" type="QString" name="size" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="size_map_unit_scale" />
                <Option value="MM" type="QString" name="size_unit" />
                <Option value="1" type="QString" name="vertical_anchor_point" />
              </Option>
              <data_defined_properties>
                <Option type="Map">
                  <Option value="" type="QString" name="name" />
                  <Option name="properties" />
                  <Option value="collection" type="QString" name="type" />
                </Option>
              </data_defined_properties>
            </layer>
            <layer id="{d3400d44-2967-426c-8a8a-432ef0c9a34f}" pass="0" enabled="1" locked="0" class="SimpleMarker">
              <Option type="Map">
                <Option value="0" type="QString" name="angle" />
                <Option value="square" type="QString" name="cap_style" />
                <Option value="0,48,205,255,rgb:0,0.1882353,0.8039216,1" type="QString" name="color" />
                <Option value="1" type="QString" name="horizontal_anchor_point" />
                <Option value="bevel" type="QString" name="joinstyle" />
                <Option value="circle" type="QString" name="name" />
                <Option value="0,0" type="QString" name="offset" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="offset_map_unit_scale" />
                <Option value="MM" type="QString" name="offset_unit" />
                <Option value="26,54,127,255,rgb:0.1019608,0.2117647,0.4980392,1" type="QString" name="outline_color" />
                <Option value="solid" type="QString" name="outline_style" />
                <Option value="0" type="QString" name="outline_width" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="outline_width_map_unit_scale" />
                <Option value="MM" type="QString" name="outline_width_unit" />
                <Option value="diameter" type="QString" name="scale_method" />
                <Option value="0.58" type="QString" name="size" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="size_map_unit_scale" />
                <Option value="MM" type="QString" name="size_unit" />
                <Option value="1" type="QString" name="vertical_anchor_point" />
              </Option>
              <data_defined_properties>
                <Option type="Map">
                  <Option value="" type="QString" name="name" />
                  <Option name="properties" />
                  <Option value="collection" type="QString" name="type" />
                </Option>
              </data_defined_properties>
            </layer>
          </symbol>
          <symbol frame_rate="10" is_animated="0" clip_to_extent="1" force_rhr="0" type="marker" name="6" alpha="1">
            <data_defined_properties>
              <Option type="Map">
                <Option value="" type="QString" name="name" />
                <Option name="properties" />
                <Option value="collection" type="QString" name="type" />
              </Option>
            </data_defined_properties>
            <layer id="{7b23b14c-0951-4dd2-a97e-9b309f9aa5d5}" pass="0" enabled="1" locked="0" class="SimpleMarker">
              <Option type="Map">
                <Option value="0" type="QString" name="angle" />
                <Option value="square" type="QString" name="cap_style" />
                <Option value="236,236,236,255,rgb:0.9254902,0.9254902,0.9254902,1" type="QString" name="color" />
                <Option value="1" type="QString" name="horizontal_anchor_point" />
                <Option value="bevel" type="QString" name="joinstyle" />
                <Option value="circle" type="QString" name="name" />
                <Option value="0,0" type="QString" name="offset" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="offset_map_unit_scale" />
                <Option value="MM" type="QString" name="offset_unit" />
                <Option value="29,70,205,255,rgb:0.1137255,0.2745098,0.8039216,1" type="QString" name="outline_color" />
                <Option value="solid" type="QString" name="outline_style" />
                <Option value="0" type="QString" name="outline_width" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="outline_width_map_unit_scale" />
                <Option value="MM" type="QString" name="outline_width_unit" />
                <Option value="diameter" type="QString" name="scale_method" />
                <Option value="2.8" type="QString" name="size" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="size_map_unit_scale" />
                <Option value="MM" type="QString" name="size_unit" />
                <Option value="1" type="QString" name="vertical_anchor_point" />
              </Option>
              <data_defined_properties>
                <Option type="Map">
                  <Option value="" type="QString" name="name" />
                  <Option name="properties" />
                  <Option value="collection" type="QString" name="type" />
                </Option>
              </data_defined_properties>
            </layer>
            <layer id="{e295c65f-3dea-4464-95e5-ca76dfca9637}" pass="0" enabled="1" locked="0" class="SimpleMarker">
              <Option type="Map">
                <Option value="0" type="QString" name="angle" />
                <Option value="square" type="QString" name="cap_style" />
                <Option value="0,48,205,255,rgb:0,0.1882353,0.8039216,1" type="QString" name="color" />
                <Option value="1" type="QString" name="horizontal_anchor_point" />
                <Option value="bevel" type="QString" name="joinstyle" />
                <Option value="circle" type="QString" name="name" />
                <Option value="0,0" type="QString" name="offset" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="offset_map_unit_scale" />
                <Option value="MM" type="QString" name="offset_unit" />
                <Option value="26,54,127,255,rgb:0.1019608,0.2117647,0.4980392,1" type="QString" name="outline_color" />
                <Option value="solid" type="QString" name="outline_style" />
                <Option value="0" type="QString" name="outline_width" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="outline_width_map_unit_scale" />
                <Option value="MM" type="QString" name="outline_width_unit" />
                <Option value="diameter" type="QString" name="scale_method" />
                <Option value="1.6" type="QString" name="size" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="size_map_unit_scale" />
                <Option value="MM" type="QString" name="size_unit" />
                <Option value="1" type="QString" name="vertical_anchor_point" />
              </Option>
              <data_defined_properties>
                <Option type="Map">
                  <Option value="" type="QString" name="name" />
                  <Option name="properties" />
                  <Option value="collection" type="QString" name="type" />
                </Option>
              </data_defined_properties>
            </layer>
          </symbol>
          <symbol frame_rate="10" is_animated="0" clip_to_extent="1" force_rhr="0" type="marker" name="7" alpha="1">
            <data_defined_properties>
              <Option type="Map">
                <Option value="" type="QString" name="name" />
                <Option name="properties" />
                <Option value="collection" type="QString" name="type" />
              </Option>
            </data_defined_properties>
            <layer id="{c5850981-fd2d-4926-9441-06597ae9f09d}" pass="0" enabled="1" locked="0" class="SimpleMarker">
              <Option type="Map">
                <Option value="0" type="QString" name="angle" />
                <Option value="square" type="QString" name="cap_style" />
                <Option value="236,236,236,255,rgb:0.9254902,0.9254902,0.9254902,1" type="QString" name="color" />
                <Option value="1" type="QString" name="horizontal_anchor_point" />
                <Option value="bevel" type="QString" name="joinstyle" />
                <Option value="circle" type="QString" name="name" />
                <Option value="0,0" type="QString" name="offset" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="offset_map_unit_scale" />
                <Option value="MM" type="QString" name="offset_unit" />
                <Option value="29,70,205,255,rgb:0.1137255,0.2745098,0.8039216,1" type="QString" name="outline_color" />
                <Option value="solid" type="QString" name="outline_style" />
                <Option value="0" type="QString" name="outline_width" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="outline_width_map_unit_scale" />
                <Option value="MM" type="QString" name="outline_width_unit" />
                <Option value="diameter" type="QString" name="scale_method" />
                <Option value="3.8" type="QString" name="size" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="size_map_unit_scale" />
                <Option value="MM" type="QString" name="size_unit" />
                <Option value="1" type="QString" name="vertical_anchor_point" />
              </Option>
              <data_defined_properties>
                <Option type="Map">
                  <Option value="" type="QString" name="name" />
                  <Option name="properties" />
                  <Option value="collection" type="QString" name="type" />
                </Option>
              </data_defined_properties>
            </layer>
            <layer id="{1082238e-50fc-4082-a263-ea64c4e45f96}" pass="0" enabled="1" locked="0" class="SimpleMarker">
              <Option type="Map">
                <Option value="0" type="QString" name="angle" />
                <Option value="square" type="QString" name="cap_style" />
                <Option value="0,48,205,255,rgb:0,0.1882353,0.8039216,1" type="QString" name="color" />
                <Option value="1" type="QString" name="horizontal_anchor_point" />
                <Option value="bevel" type="QString" name="joinstyle" />
                <Option value="circle" type="QString" name="name" />
                <Option value="0,0" type="QString" name="offset" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="offset_map_unit_scale" />
                <Option value="MM" type="QString" name="offset_unit" />
                <Option value="26,54,127,255,rgb:0.1019608,0.2117647,0.4980392,1" type="QString" name="outline_color" />
                <Option value="solid" type="QString" name="outline_style" />
                <Option value="0" type="QString" name="outline_width" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="outline_width_map_unit_scale" />
                <Option value="MM" type="QString" name="outline_width_unit" />
                <Option value="diameter" type="QString" name="scale_method" />
                <Option value="2.375" type="QString" name="size" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="size_map_unit_scale" />
                <Option value="MM" type="QString" name="size_unit" />
                <Option value="1" type="QString" name="vertical_anchor_point" />
              </Option>
              <data_defined_properties>
                <Option type="Map">
                  <Option value="" type="QString" name="name" />
                  <Option name="properties" />
                  <Option value="collection" type="QString" name="type" />
                </Option>
              </data_defined_properties>
            </layer>
          </symbol>
          <symbol frame_rate="10" is_animated="0" clip_to_extent="1" force_rhr="0" type="marker" name="8" alpha="1">
            <data_defined_properties>
              <Option type="Map">
                <Option value="" type="QString" name="name" />
                <Option name="properties" />
                <Option value="collection" type="QString" name="type" />
              </Option>
            </data_defined_properties>
            <layer id="{f44c1044-7bee-42dd-950a-8102ec0ac088}" pass="0" enabled="1" locked="0" class="SimpleMarker">
              <Option type="Map">
                <Option value="0" type="QString" name="angle" />
                <Option value="square" type="QString" name="cap_style" />
                <Option value="29,70,205,255,rgb:0.1137255,0.2745098,0.8039216,1" type="QString" name="color" />
                <Option value="1" type="QString" name="horizontal_anchor_point" />
                <Option value="bevel" type="QString" name="joinstyle" />
                <Option value="circle" type="QString" name="name" />
                <Option value="0,0" type="QString" name="offset" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="offset_map_unit_scale" />
                <Option value="MM" type="QString" name="offset_unit" />
                <Option value="26,54,127,255,rgb:0.1019608,0.2117647,0.4980392,1" type="QString" name="outline_color" />
                <Option value="solid" type="QString" name="outline_style" />
                <Option value="0" type="QString" name="outline_width" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="outline_width_map_unit_scale" />
                <Option value="MM" type="QString" name="outline_width_unit" />
                <Option value="diameter" type="QString" name="scale_method" />
                <Option value="1.8" type="QString" name="size" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="size_map_unit_scale" />
                <Option value="MM" type="QString" name="size_unit" />
                <Option value="1" type="QString" name="vertical_anchor_point" />
              </Option>
              <data_defined_properties>
                <Option type="Map">
                  <Option value="" type="QString" name="name" />
                  <Option name="properties" />
                  <Option value="collection" type="QString" name="type" />
                </Option>
              </data_defined_properties>
            </layer>
          </symbol>
          <symbol frame_rate="10" is_animated="0" clip_to_extent="1" force_rhr="0" type="marker" name="9" alpha="1">
            <data_defined_properties>
              <Option type="Map">
                <Option value="" type="QString" name="name" />
                <Option name="properties" />
                <Option value="collection" type="QString" name="type" />
              </Option>
            </data_defined_properties>
            <layer id="{482b3288-b876-4028-a1b0-5f5cd23784a9}" pass="0" enabled="1" locked="0" class="SimpleMarker">
              <Option type="Map">
                <Option value="0" type="QString" name="angle" />
                <Option value="square" type="QString" name="cap_style" />
                <Option value="29,70,205,255,rgb:0.1137255,0.2745098,0.8039216,1" type="QString" name="color" />
                <Option value="1" type="QString" name="horizontal_anchor_point" />
                <Option value="bevel" type="QString" name="joinstyle" />
                <Option value="circle" type="QString" name="name" />
                <Option value="0,0" type="QString" name="offset" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="offset_map_unit_scale" />
                <Option value="MM" type="QString" name="offset_unit" />
                <Option value="26,54,127,255,rgb:0.1019608,0.2117647,0.4980392,1" type="QString" name="outline_color" />
                <Option value="solid" type="QString" name="outline_style" />
                <Option value="0" type="QString" name="outline_width" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="outline_width_map_unit_scale" />
                <Option value="MM" type="QString" name="outline_width_unit" />
                <Option value="diameter" type="QString" name="scale_method" />
                <Option value="1.8" type="QString" name="size" />
                <Option value="3x:0,0,0,0,0,0" type="QString" name="size_map_unit_scale" />
                <Option value="MM" type="QString" name="size_unit" />
                <Option value="1" type="QString" name="vertical_anchor_point" />
              </Option>
              <data_defined_properties>
                <Option type="Map">
                  <Option value="" type="QString" name="name" />
                  <Option name="properties" />
                  <Option value="collection" type="QString" name="type" />
                </Option>
              </data_defined_properties>
            </layer>
          </symbol>
        </symbols>
        <data-defined-properties>
          <Option type="Map">
            <Option value="" type="QString" name="name" />
            <Option name="properties" />
            <Option value="collection" type="QString" name="type" />
          </Option>
        </data-defined-properties>
      </renderer-v2>
      
<blendMode>0</blendMode>
      
<featureBlendMode>0</featureBlendMode>
      
<layerOpacity>1</layerOpacity>
      
</qgis>