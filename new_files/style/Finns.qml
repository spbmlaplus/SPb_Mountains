<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE qgis PUBLIC "http://mrcc.com/qgis.dtd" "SYSTEM">
<qgis version="3.44.8-Solothurn" styleCategories="AllStyleCategories" layername="Finns">
<renderer-v2 referencescale="-1" forceraster="0" type="RuleRenderer" enableorderby="0" symbollevels="0">
        <rules key="{1c9b72cb-c229-4b5c-a250-5d908436be53}">
          <rule label="Доля финнов &lt;1% от всего населения" symbol="0" filter="&quot;FINNS%&quot; &lt;= 1.0000000000000000" key="{1acf14f6-f64a-4d4b-917b-5f3b19647be7}">
            <rule label="Численность финнов 1 - 10 человек" symbol="1" filter="&quot;FINNS&quot; &gt;= 1.0000 AND &quot;FINNS&quot; &lt;= 10.0000" key="{44aec278-a958-4163-b357-e950da501e1c}" />
            <rule label="Численность финнов 10  - 100 человек" symbol="2" filter="&quot;FINNS&quot; &gt; 10.0000 AND &quot;FINNS&quot; &lt;= 100.0000" key="{baf5abd2-a91a-442d-9260-adf92ec4fa5e}" />
            <rule label="Численность финнов более 100 человек" symbol="3" filter="&quot;FINNS&quot; &gt; 100.0000 AND &quot;FINNS&quot; &lt;= 2395.0000" key="{9263bd38-129d-4a4f-a0f5-d49ab6f04607}" />
          </rule>
          <rule label="Доля финнов 1-5% от всего населения " symbol="4" filter="&quot;FINNS%&quot; &gt; 1.0000000000000000 AND &quot;FINNS%&quot; &lt;= 3.0000000000000000" key="{a5c4decc-bcde-40fa-8825-4c98e4d877f2}">
            <rule label="Численность финнов 1 - 10 человек" symbol="5" filter="&quot;FINNS&quot; &gt;= 1.0000 AND &quot;FINNS&quot; &lt;= 10.0000" key="{30b9fb74-3b36-4323-8a98-ef7d0db7e4a7}" />
            <rule label="Численность финнов 10  - 100 человек" symbol="6" filter="&quot;FINNS&quot; &gt; 10.0000 AND &quot;FINNS&quot; &lt;= 100.0000" key="{9520aadc-b4d8-420e-b3f1-4304626332ec}" />
            <rule label="Численность финнов более 100 человек" symbol="7" filter="&quot;FINNS&quot; &gt; 100.0000 AND &quot;FINNS&quot; &lt;= 2395.0000" key="{9924f2ff-49e0-44e4-bfc5-19a758748fd9}" />
          </rule>
          <rule label="Доля финнов &gt;5% от всего населения" symbol="8" filter="&quot;FINNS%&quot; &gt; 3.0000000000000000" key="{822669e4-8b1e-4ff4-a33a-64dd808ed6d4}">
            <rule label="Численность финнов 1 - 10 человек" symbol="9" filter="&quot;FINNS&quot; &gt;= 1.0000 AND &quot;FINNS&quot; &lt;= 10.0000" key="{cee4e46b-4fbb-4448-8eb4-4e5ee0750f45}" />
            <rule label="Численность финнов 10  - 100 человек" symbol="10" filter="&quot;FINNS&quot; &gt; 10.0000 AND &quot;FINNS&quot; &lt;= 100.0000" key="{ac080308-b368-4bc3-9525-655182b04c9e}" />
            <rule label="Численность финнов более 100 человек" symbol="11" filter="&quot;FINNS&quot; &gt; 100.0000 AND &quot;FINNS&quot; &lt;= 2395.0000" key="{aa48d097-63a5-41d7-bba8-38e99863ec1b}" />
          </rule>
        </rules>
        <symbols>
          <symbol force_rhr="0" alpha="1" name="0" clip_to_extent="1" type="marker" frame_rate="10" is_animated="0">
            <data_defined_properties>
              <Option type="Map">
                <Option name="name" value="" type="QString" />
                <Option name="properties" />
                <Option name="type" value="collection" type="QString" />
              </Option>
            </data_defined_properties>
            <layer id="{3e24b19f-c0e6-454a-ab30-ffb7cb4d32fb}" class="SimpleMarker" pass="0" locked="0" enabled="1">
              <Option type="Map">
                <Option name="angle" value="0" type="QString" />
                <Option name="cap_style" value="square" type="QString" />
                <Option name="color" value="236,236,236,255,rgb:0.9254902,0.9254902,0.9254902,1" type="QString" />
                <Option name="horizontal_anchor_point" value="1" type="QString" />
                <Option name="joinstyle" value="bevel" type="QString" />
                <Option name="name" value="circle" type="QString" />
                <Option name="offset" value="0,0" type="QString" />
                <Option name="offset_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="offset_unit" value="MM" type="QString" />
                <Option name="outline_color" value="29,70,205,255,rgb:0.1137255,0.2745098,0.8039216,1" type="QString" />
                <Option name="outline_style" value="solid" type="QString" />
                <Option name="outline_width" value="0" type="QString" />
                <Option name="outline_width_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="outline_width_unit" value="MM" type="QString" />
                <Option name="scale_method" value="diameter" type="QString" />
                <Option name="size" value="1" type="QString" />
                <Option name="size_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="size_unit" value="MM" type="QString" />
                <Option name="vertical_anchor_point" value="1" type="QString" />
              </Option>
              <data_defined_properties>
                <Option type="Map">
                  <Option name="name" value="" type="QString" />
                  <Option name="properties" />
                  <Option name="type" value="collection" type="QString" />
                </Option>
              </data_defined_properties>
            </layer>
          </symbol>
          <symbol force_rhr="0" alpha="1" name="1" clip_to_extent="1" type="marker" frame_rate="10" is_animated="0">
            <data_defined_properties>
              <Option type="Map">
                <Option name="name" value="" type="QString" />
                <Option name="properties" />
                <Option name="type" value="collection" type="QString" />
              </Option>
            </data_defined_properties>
            <layer id="{74f1f57c-78cb-4dc1-838c-14d1fcd31120}" class="SimpleMarker" pass="0" locked="0" enabled="1">
              <Option type="Map">
                <Option name="angle" value="0" type="QString" />
                <Option name="cap_style" value="square" type="QString" />
                <Option name="color" value="236,236,236,255,rgb:0.9254902,0.9254902,0.9254902,1" type="QString" />
                <Option name="horizontal_anchor_point" value="1" type="QString" />
                <Option name="joinstyle" value="bevel" type="QString" />
                <Option name="name" value="circle" type="QString" />
                <Option name="offset" value="0,0" type="QString" />
                <Option name="offset_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="offset_unit" value="MM" type="QString" />
                <Option name="outline_color" value="29,70,205,255,rgb:0.1137255,0.2745098,0.8039216,1" type="QString" />
                <Option name="outline_style" value="solid" type="QString" />
                <Option name="outline_width" value="0.24" type="QString" />
                <Option name="outline_width_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="outline_width_unit" value="MM" type="QString" />
                <Option name="scale_method" value="diameter" type="QString" />
                <Option name="size" value="1.8" type="QString" />
                <Option name="size_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="size_unit" value="MM" type="QString" />
                <Option name="vertical_anchor_point" value="1" type="QString" />
              </Option>
              <data_defined_properties>
                <Option type="Map">
                  <Option name="name" value="" type="QString" />
                  <Option name="properties" />
                  <Option name="type" value="collection" type="QString" />
                </Option>
              </data_defined_properties>
            </layer>
          </symbol>
          <symbol force_rhr="0" alpha="1" name="10" clip_to_extent="1" type="marker" frame_rate="10" is_animated="0">
            <data_defined_properties>
              <Option type="Map">
                <Option name="name" value="" type="QString" />
                <Option name="properties" />
                <Option name="type" value="collection" type="QString" />
              </Option>
            </data_defined_properties>
            <layer id="{77e74b5c-76a9-4a2c-bde6-e0ab1aee7ec7}" class="SimpleMarker" pass="0" locked="0" enabled="1">
              <Option type="Map">
                <Option name="angle" value="0" type="QString" />
                <Option name="cap_style" value="square" type="QString" />
                <Option name="color" value="29,70,205,255,rgb:0.1137255,0.2745098,0.8039216,1" type="QString" />
                <Option name="horizontal_anchor_point" value="1" type="QString" />
                <Option name="joinstyle" value="bevel" type="QString" />
                <Option name="name" value="circle" type="QString" />
                <Option name="offset" value="0,0" type="QString" />
                <Option name="offset_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="offset_unit" value="MM" type="QString" />
                <Option name="outline_color" value="26,54,127,255,rgb:0.1019608,0.2117647,0.4980392,1" type="QString" />
                <Option name="outline_style" value="solid" type="QString" />
                <Option name="outline_width" value="0" type="QString" />
                <Option name="outline_width_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="outline_width_unit" value="MM" type="QString" />
                <Option name="scale_method" value="diameter" type="QString" />
                <Option name="size" value="2.8" type="QString" />
                <Option name="size_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="size_unit" value="MM" type="QString" />
                <Option name="vertical_anchor_point" value="1" type="QString" />
              </Option>
              <data_defined_properties>
                <Option type="Map">
                  <Option name="name" value="" type="QString" />
                  <Option name="properties" />
                  <Option name="type" value="collection" type="QString" />
                </Option>
              </data_defined_properties>
            </layer>
          </symbol>
          <symbol force_rhr="0" alpha="1" name="11" clip_to_extent="1" type="marker" frame_rate="10" is_animated="0">
            <data_defined_properties>
              <Option type="Map">
                <Option name="name" value="" type="QString" />
                <Option name="properties" />
                <Option name="type" value="collection" type="QString" />
              </Option>
            </data_defined_properties>
            <layer id="{c4c0dc7f-49b3-49a5-a17b-5a2a61a3b35a}" class="SimpleMarker" pass="0" locked="0" enabled="1">
              <Option type="Map">
                <Option name="angle" value="0" type="QString" />
                <Option name="cap_style" value="square" type="QString" />
                <Option name="color" value="29,70,205,255,rgb:0.1137255,0.2745098,0.8039216,1" type="QString" />
                <Option name="horizontal_anchor_point" value="1" type="QString" />
                <Option name="joinstyle" value="bevel" type="QString" />
                <Option name="name" value="circle" type="QString" />
                <Option name="offset" value="0,0" type="QString" />
                <Option name="offset_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="offset_unit" value="MM" type="QString" />
                <Option name="outline_color" value="26,54,127,255,rgb:0.1019608,0.2117647,0.4980392,1" type="QString" />
                <Option name="outline_style" value="solid" type="QString" />
                <Option name="outline_width" value="0" type="QString" />
                <Option name="outline_width_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="outline_width_unit" value="MM" type="QString" />
                <Option name="scale_method" value="diameter" type="QString" />
                <Option name="size" value="3.8" type="QString" />
                <Option name="size_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="size_unit" value="MM" type="QString" />
                <Option name="vertical_anchor_point" value="1" type="QString" />
              </Option>
              <data_defined_properties>
                <Option type="Map">
                  <Option name="name" value="" type="QString" />
                  <Option name="properties" />
                  <Option name="type" value="collection" type="QString" />
                </Option>
              </data_defined_properties>
            </layer>
          </symbol>
          <symbol force_rhr="0" alpha="1" name="2" clip_to_extent="1" type="marker" frame_rate="10" is_animated="0">
            <data_defined_properties>
              <Option type="Map">
                <Option name="name" value="" type="QString" />
                <Option name="properties" />
                <Option name="type" value="collection" type="QString" />
              </Option>
            </data_defined_properties>
            <layer id="{ab84fe08-5453-4733-bd5f-c8404546b79e}" class="SimpleMarker" pass="0" locked="0" enabled="1">
              <Option type="Map">
                <Option name="angle" value="0" type="QString" />
                <Option name="cap_style" value="square" type="QString" />
                <Option name="color" value="236,236,236,255,rgb:0.9254902,0.9254902,0.9254902,1" type="QString" />
                <Option name="horizontal_anchor_point" value="1" type="QString" />
                <Option name="joinstyle" value="bevel" type="QString" />
                <Option name="name" value="circle" type="QString" />
                <Option name="offset" value="0,0" type="QString" />
                <Option name="offset_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="offset_unit" value="MM" type="QString" />
                <Option name="outline_color" value="29,70,205,255,rgb:0.1137255,0.2745098,0.8039216,1" type="QString" />
                <Option name="outline_style" value="solid" type="QString" />
                <Option name="outline_width" value="0.25" type="QString" />
                <Option name="outline_width_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="outline_width_unit" value="MM" type="QString" />
                <Option name="scale_method" value="diameter" type="QString" />
                <Option name="size" value="2.8" type="QString" />
                <Option name="size_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="size_unit" value="MM" type="QString" />
                <Option name="vertical_anchor_point" value="1" type="QString" />
              </Option>
              <data_defined_properties>
                <Option type="Map">
                  <Option name="name" value="" type="QString" />
                  <Option name="properties" />
                  <Option name="type" value="collection" type="QString" />
                </Option>
              </data_defined_properties>
            </layer>
          </symbol>
          <symbol force_rhr="0" alpha="1" name="3" clip_to_extent="1" type="marker" frame_rate="10" is_animated="0">
            <data_defined_properties>
              <Option type="Map">
                <Option name="name" value="" type="QString" />
                <Option name="properties" />
                <Option name="type" value="collection" type="QString" />
              </Option>
            </data_defined_properties>
            <layer id="{e0913feb-6bd9-4d3b-b8e0-f754a2450bdf}" class="SimpleMarker" pass="0" locked="0" enabled="1">
              <Option type="Map">
                <Option name="angle" value="0" type="QString" />
                <Option name="cap_style" value="square" type="QString" />
                <Option name="color" value="236,236,236,255,rgb:0.9254902,0.9254902,0.9254902,1" type="QString" />
                <Option name="horizontal_anchor_point" value="1" type="QString" />
                <Option name="joinstyle" value="bevel" type="QString" />
                <Option name="name" value="circle" type="QString" />
                <Option name="offset" value="0,0" type="QString" />
                <Option name="offset_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="offset_unit" value="MM" type="QString" />
                <Option name="outline_color" value="29,70,205,255,rgb:0.1137255,0.2745098,0.8039216,1" type="QString" />
                <Option name="outline_style" value="solid" type="QString" />
                <Option name="outline_width" value="0.3" type="QString" />
                <Option name="outline_width_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="outline_width_unit" value="MM" type="QString" />
                <Option name="scale_method" value="diameter" type="QString" />
                <Option name="size" value="3.8" type="QString" />
                <Option name="size_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="size_unit" value="MM" type="QString" />
                <Option name="vertical_anchor_point" value="1" type="QString" />
              </Option>
              <data_defined_properties>
                <Option type="Map">
                  <Option name="name" value="" type="QString" />
                  <Option name="properties" />
                  <Option name="type" value="collection" type="QString" />
                </Option>
              </data_defined_properties>
            </layer>
          </symbol>
          <symbol force_rhr="0" alpha="1" name="4" clip_to_extent="1" type="marker" frame_rate="10" is_animated="0">
            <data_defined_properties>
              <Option type="Map">
                <Option name="name" value="" type="QString" />
                <Option name="properties" />
                <Option name="type" value="collection" type="QString" />
              </Option>
            </data_defined_properties>
            <layer id="{618bb969-17ce-402f-b7e0-1eaf7a81ac08}" class="SimpleMarker" pass="0" locked="0" enabled="1">
              <Option type="Map">
                <Option name="angle" value="0" type="QString" />
                <Option name="cap_style" value="square" type="QString" />
                <Option name="color" value="236,236,236,255,rgb:0.9254902,0.9254902,0.9254902,1" type="QString" />
                <Option name="horizontal_anchor_point" value="1" type="QString" />
                <Option name="joinstyle" value="bevel" type="QString" />
                <Option name="name" value="circle" type="QString" />
                <Option name="offset" value="0,0" type="QString" />
                <Option name="offset_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="offset_unit" value="MM" type="QString" />
                <Option name="outline_color" value="29,70,205,255,rgb:0.1137255,0.2745098,0.8039216,1" type="QString" />
                <Option name="outline_style" value="solid" type="QString" />
                <Option name="outline_width" value="0" type="QString" />
                <Option name="outline_width_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="outline_width_unit" value="MM" type="QString" />
                <Option name="scale_method" value="diameter" type="QString" />
                <Option name="size" value="1" type="QString" />
                <Option name="size_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="size_unit" value="MM" type="QString" />
                <Option name="vertical_anchor_point" value="1" type="QString" />
              </Option>
              <data_defined_properties>
                <Option type="Map">
                  <Option name="name" value="" type="QString" />
                  <Option name="properties" />
                  <Option name="type" value="collection" type="QString" />
                </Option>
              </data_defined_properties>
            </layer>
            <layer id="{b40cca64-6736-43cc-bc1f-1f54f5a5150d}" class="SimpleMarker" pass="0" locked="0" enabled="1">
              <Option type="Map">
                <Option name="angle" value="0" type="QString" />
                <Option name="cap_style" value="square" type="QString" />
                <Option name="color" value="0,48,205,255,rgb:0,0.1882353,0.8039216,1" type="QString" />
                <Option name="horizontal_anchor_point" value="1" type="QString" />
                <Option name="joinstyle" value="bevel" type="QString" />
                <Option name="name" value="circle" type="QString" />
                <Option name="offset" value="0,0" type="QString" />
                <Option name="offset_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="offset_unit" value="MM" type="QString" />
                <Option name="outline_color" value="26,54,127,255,rgb:0.1019608,0.2117647,0.4980392,1" type="QString" />
                <Option name="outline_style" value="solid" type="QString" />
                <Option name="outline_width" value="0" type="QString" />
                <Option name="outline_width_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="outline_width_unit" value="MM" type="QString" />
                <Option name="scale_method" value="diameter" type="QString" />
                <Option name="size" value="0.425" type="QString" />
                <Option name="size_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="size_unit" value="MM" type="QString" />
                <Option name="vertical_anchor_point" value="1" type="QString" />
              </Option>
              <data_defined_properties>
                <Option type="Map">
                  <Option name="name" value="" type="QString" />
                  <Option name="properties" />
                  <Option name="type" value="collection" type="QString" />
                </Option>
              </data_defined_properties>
            </layer>
          </symbol>
          <symbol force_rhr="0" alpha="1" name="5" clip_to_extent="1" type="marker" frame_rate="10" is_animated="0">
            <data_defined_properties>
              <Option type="Map">
                <Option name="name" value="" type="QString" />
                <Option name="properties" />
                <Option name="type" value="collection" type="QString" />
              </Option>
            </data_defined_properties>
            <layer id="{9638b4b8-ff07-4b6a-9514-6697f9b31a63}" class="SimpleMarker" pass="0" locked="0" enabled="1">
              <Option type="Map">
                <Option name="angle" value="0" type="QString" />
                <Option name="cap_style" value="square" type="QString" />
                <Option name="color" value="236,236,236,255,rgb:0.9254902,0.9254902,0.9254902,1" type="QString" />
                <Option name="horizontal_anchor_point" value="1" type="QString" />
                <Option name="joinstyle" value="bevel" type="QString" />
                <Option name="name" value="circle" type="QString" />
                <Option name="offset" value="0,0" type="QString" />
                <Option name="offset_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="offset_unit" value="MM" type="QString" />
                <Option name="outline_color" value="29,70,205,255,rgb:0.1137255,0.2745098,0.8039216,1" type="QString" />
                <Option name="outline_style" value="solid" type="QString" />
                <Option name="outline_width" value="0" type="QString" />
                <Option name="outline_width_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="outline_width_unit" value="MM" type="QString" />
                <Option name="scale_method" value="diameter" type="QString" />
                <Option name="size" value="1.8" type="QString" />
                <Option name="size_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="size_unit" value="MM" type="QString" />
                <Option name="vertical_anchor_point" value="1" type="QString" />
              </Option>
              <data_defined_properties>
                <Option type="Map">
                  <Option name="name" value="" type="QString" />
                  <Option name="properties" />
                  <Option name="type" value="collection" type="QString" />
                </Option>
              </data_defined_properties>
            </layer>
            <layer id="{d3400d44-2967-426c-8a8a-432ef0c9a34f}" class="SimpleMarker" pass="0" locked="0" enabled="1">
              <Option type="Map">
                <Option name="angle" value="0" type="QString" />
                <Option name="cap_style" value="square" type="QString" />
                <Option name="color" value="0,48,205,255,rgb:0,0.1882353,0.8039216,1" type="QString" />
                <Option name="horizontal_anchor_point" value="1" type="QString" />
                <Option name="joinstyle" value="bevel" type="QString" />
                <Option name="name" value="circle" type="QString" />
                <Option name="offset" value="0,0" type="QString" />
                <Option name="offset_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="offset_unit" value="MM" type="QString" />
                <Option name="outline_color" value="26,54,127,255,rgb:0.1019608,0.2117647,0.4980392,1" type="QString" />
                <Option name="outline_style" value="solid" type="QString" />
                <Option name="outline_width" value="0" type="QString" />
                <Option name="outline_width_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="outline_width_unit" value="MM" type="QString" />
                <Option name="scale_method" value="diameter" type="QString" />
                <Option name="size" value="0.58" type="QString" />
                <Option name="size_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="size_unit" value="MM" type="QString" />
                <Option name="vertical_anchor_point" value="1" type="QString" />
              </Option>
              <data_defined_properties>
                <Option type="Map">
                  <Option name="name" value="" type="QString" />
                  <Option name="properties" />
                  <Option name="type" value="collection" type="QString" />
                </Option>
              </data_defined_properties>
            </layer>
          </symbol>
          <symbol force_rhr="0" alpha="1" name="6" clip_to_extent="1" type="marker" frame_rate="10" is_animated="0">
            <data_defined_properties>
              <Option type="Map">
                <Option name="name" value="" type="QString" />
                <Option name="properties" />
                <Option name="type" value="collection" type="QString" />
              </Option>
            </data_defined_properties>
            <layer id="{7b23b14c-0951-4dd2-a97e-9b309f9aa5d5}" class="SimpleMarker" pass="0" locked="0" enabled="1">
              <Option type="Map">
                <Option name="angle" value="0" type="QString" />
                <Option name="cap_style" value="square" type="QString" />
                <Option name="color" value="236,236,236,255,rgb:0.9254902,0.9254902,0.9254902,1" type="QString" />
                <Option name="horizontal_anchor_point" value="1" type="QString" />
                <Option name="joinstyle" value="bevel" type="QString" />
                <Option name="name" value="circle" type="QString" />
                <Option name="offset" value="0,0" type="QString" />
                <Option name="offset_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="offset_unit" value="MM" type="QString" />
                <Option name="outline_color" value="29,70,205,255,rgb:0.1137255,0.2745098,0.8039216,1" type="QString" />
                <Option name="outline_style" value="solid" type="QString" />
                <Option name="outline_width" value="0" type="QString" />
                <Option name="outline_width_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="outline_width_unit" value="MM" type="QString" />
                <Option name="scale_method" value="diameter" type="QString" />
                <Option name="size" value="2.8" type="QString" />
                <Option name="size_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="size_unit" value="MM" type="QString" />
                <Option name="vertical_anchor_point" value="1" type="QString" />
              </Option>
              <data_defined_properties>
                <Option type="Map">
                  <Option name="name" value="" type="QString" />
                  <Option name="properties" />
                  <Option name="type" value="collection" type="QString" />
                </Option>
              </data_defined_properties>
            </layer>
            <layer id="{e295c65f-3dea-4464-95e5-ca76dfca9637}" class="SimpleMarker" pass="0" locked="0" enabled="1">
              <Option type="Map">
                <Option name="angle" value="0" type="QString" />
                <Option name="cap_style" value="square" type="QString" />
                <Option name="color" value="0,48,205,255,rgb:0,0.1882353,0.8039216,1" type="QString" />
                <Option name="horizontal_anchor_point" value="1" type="QString" />
                <Option name="joinstyle" value="bevel" type="QString" />
                <Option name="name" value="circle" type="QString" />
                <Option name="offset" value="0,0" type="QString" />
                <Option name="offset_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="offset_unit" value="MM" type="QString" />
                <Option name="outline_color" value="26,54,127,255,rgb:0.1019608,0.2117647,0.4980392,1" type="QString" />
                <Option name="outline_style" value="solid" type="QString" />
                <Option name="outline_width" value="0" type="QString" />
                <Option name="outline_width_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="outline_width_unit" value="MM" type="QString" />
                <Option name="scale_method" value="diameter" type="QString" />
                <Option name="size" value="1.6" type="QString" />
                <Option name="size_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="size_unit" value="MM" type="QString" />
                <Option name="vertical_anchor_point" value="1" type="QString" />
              </Option>
              <data_defined_properties>
                <Option type="Map">
                  <Option name="name" value="" type="QString" />
                  <Option name="properties" />
                  <Option name="type" value="collection" type="QString" />
                </Option>
              </data_defined_properties>
            </layer>
          </symbol>
          <symbol force_rhr="0" alpha="1" name="7" clip_to_extent="1" type="marker" frame_rate="10" is_animated="0">
            <data_defined_properties>
              <Option type="Map">
                <Option name="name" value="" type="QString" />
                <Option name="properties" />
                <Option name="type" value="collection" type="QString" />
              </Option>
            </data_defined_properties>
            <layer id="{c5850981-fd2d-4926-9441-06597ae9f09d}" class="SimpleMarker" pass="0" locked="0" enabled="1">
              <Option type="Map">
                <Option name="angle" value="0" type="QString" />
                <Option name="cap_style" value="square" type="QString" />
                <Option name="color" value="236,236,236,255,rgb:0.9254902,0.9254902,0.9254902,1" type="QString" />
                <Option name="horizontal_anchor_point" value="1" type="QString" />
                <Option name="joinstyle" value="bevel" type="QString" />
                <Option name="name" value="circle" type="QString" />
                <Option name="offset" value="0,0" type="QString" />
                <Option name="offset_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="offset_unit" value="MM" type="QString" />
                <Option name="outline_color" value="29,70,205,255,rgb:0.1137255,0.2745098,0.8039216,1" type="QString" />
                <Option name="outline_style" value="solid" type="QString" />
                <Option name="outline_width" value="0" type="QString" />
                <Option name="outline_width_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="outline_width_unit" value="MM" type="QString" />
                <Option name="scale_method" value="diameter" type="QString" />
                <Option name="size" value="3.8" type="QString" />
                <Option name="size_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="size_unit" value="MM" type="QString" />
                <Option name="vertical_anchor_point" value="1" type="QString" />
              </Option>
              <data_defined_properties>
                <Option type="Map">
                  <Option name="name" value="" type="QString" />
                  <Option name="properties" />
                  <Option name="type" value="collection" type="QString" />
                </Option>
              </data_defined_properties>
            </layer>
            <layer id="{1082238e-50fc-4082-a263-ea64c4e45f96}" class="SimpleMarker" pass="0" locked="0" enabled="1">
              <Option type="Map">
                <Option name="angle" value="0" type="QString" />
                <Option name="cap_style" value="square" type="QString" />
                <Option name="color" value="0,48,205,255,rgb:0,0.1882353,0.8039216,1" type="QString" />
                <Option name="horizontal_anchor_point" value="1" type="QString" />
                <Option name="joinstyle" value="bevel" type="QString" />
                <Option name="name" value="circle" type="QString" />
                <Option name="offset" value="0,0" type="QString" />
                <Option name="offset_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="offset_unit" value="MM" type="QString" />
                <Option name="outline_color" value="26,54,127,255,rgb:0.1019608,0.2117647,0.4980392,1" type="QString" />
                <Option name="outline_style" value="solid" type="QString" />
                <Option name="outline_width" value="0" type="QString" />
                <Option name="outline_width_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="outline_width_unit" value="MM" type="QString" />
                <Option name="scale_method" value="diameter" type="QString" />
                <Option name="size" value="2.375" type="QString" />
                <Option name="size_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="size_unit" value="MM" type="QString" />
                <Option name="vertical_anchor_point" value="1" type="QString" />
              </Option>
              <data_defined_properties>
                <Option type="Map">
                  <Option name="name" value="" type="QString" />
                  <Option name="properties" />
                  <Option name="type" value="collection" type="QString" />
                </Option>
              </data_defined_properties>
            </layer>
          </symbol>
          <symbol force_rhr="0" alpha="1" name="8" clip_to_extent="1" type="marker" frame_rate="10" is_animated="0">
            <data_defined_properties>
              <Option type="Map">
                <Option name="name" value="" type="QString" />
                <Option name="properties" />
                <Option name="type" value="collection" type="QString" />
              </Option>
            </data_defined_properties>
            <layer id="{f44c1044-7bee-42dd-950a-8102ec0ac088}" class="SimpleMarker" pass="0" locked="0" enabled="1">
              <Option type="Map">
                <Option name="angle" value="0" type="QString" />
                <Option name="cap_style" value="square" type="QString" />
                <Option name="color" value="29,70,205,255,rgb:0.1137255,0.2745098,0.8039216,1" type="QString" />
                <Option name="horizontal_anchor_point" value="1" type="QString" />
                <Option name="joinstyle" value="bevel" type="QString" />
                <Option name="name" value="circle" type="QString" />
                <Option name="offset" value="0,0" type="QString" />
                <Option name="offset_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="offset_unit" value="MM" type="QString" />
                <Option name="outline_color" value="26,54,127,255,rgb:0.1019608,0.2117647,0.4980392,1" type="QString" />
                <Option name="outline_style" value="solid" type="QString" />
                <Option name="outline_width" value="0" type="QString" />
                <Option name="outline_width_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="outline_width_unit" value="MM" type="QString" />
                <Option name="scale_method" value="diameter" type="QString" />
                <Option name="size" value="1.8" type="QString" />
                <Option name="size_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="size_unit" value="MM" type="QString" />
                <Option name="vertical_anchor_point" value="1" type="QString" />
              </Option>
              <data_defined_properties>
                <Option type="Map">
                  <Option name="name" value="" type="QString" />
                  <Option name="properties" />
                  <Option name="type" value="collection" type="QString" />
                </Option>
              </data_defined_properties>
            </layer>
          </symbol>
          <symbol force_rhr="0" alpha="1" name="9" clip_to_extent="1" type="marker" frame_rate="10" is_animated="0">
            <data_defined_properties>
              <Option type="Map">
                <Option name="name" value="" type="QString" />
                <Option name="properties" />
                <Option name="type" value="collection" type="QString" />
              </Option>
            </data_defined_properties>
            <layer id="{482b3288-b876-4028-a1b0-5f5cd23784a9}" class="SimpleMarker" pass="0" locked="0" enabled="1">
              <Option type="Map">
                <Option name="angle" value="0" type="QString" />
                <Option name="cap_style" value="square" type="QString" />
                <Option name="color" value="29,70,205,255,rgb:0.1137255,0.2745098,0.8039216,1" type="QString" />
                <Option name="horizontal_anchor_point" value="1" type="QString" />
                <Option name="joinstyle" value="bevel" type="QString" />
                <Option name="name" value="circle" type="QString" />
                <Option name="offset" value="0,0" type="QString" />
                <Option name="offset_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="offset_unit" value="MM" type="QString" />
                <Option name="outline_color" value="26,54,127,255,rgb:0.1019608,0.2117647,0.4980392,1" type="QString" />
                <Option name="outline_style" value="solid" type="QString" />
                <Option name="outline_width" value="0" type="QString" />
                <Option name="outline_width_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="outline_width_unit" value="MM" type="QString" />
                <Option name="scale_method" value="diameter" type="QString" />
                <Option name="size" value="1.8" type="QString" />
                <Option name="size_map_unit_scale" value="3x:0,0,0,0,0,0" type="QString" />
                <Option name="size_unit" value="MM" type="QString" />
                <Option name="vertical_anchor_point" value="1" type="QString" />
              </Option>
              <data_defined_properties>
                <Option type="Map">
                  <Option name="name" value="" type="QString" />
                  <Option name="properties" />
                  <Option name="type" value="collection" type="QString" />
                </Option>
              </data_defined_properties>
            </layer>
          </symbol>
        </symbols>
        <data-defined-properties>
          <Option type="Map">
            <Option name="name" value="" type="QString" />
            <Option name="properties" />
            <Option name="type" value="collection" type="QString" />
          </Option>
        </data-defined-properties>
      </renderer-v2>
      
<blendMode>0</blendMode>
      
<featureBlendMode>0</featureBlendMode>
      
<layerOpacity>1</layerOpacity>
      
</qgis>